/* eslint no-console:0 */
var auth;
/* ../../ so it can be used in a child module */
try {
    auth = require('../../auth.json');
} catch (e) {
    auth = {
        token: ''
    };
}

auth = require('./auth.json');

const request = require('request');
const asyncLib = require('async');

/* SETTINGS */
var domain = 'byui'; // default to byui
var apiCounter = 0; // counts api calls made
var rateLimit = 700; // used for throttling. 700 is the max value
const buffer = 150; // once the rateLimit passes this point we pause the queue
var queue = asyncLib.queue(preFlightCheck, 20); // 20 is the max number of operations running at any one time

/* START INTERNAL HELPER FUNCTIONS */

/*************************************
 * handles calls where pagination may
 * be necessary. returns to cb given
 * to original function
 ************************************/
function paginate(response, caller, data, finalCb) {
    if (response.headers.link == undefined) {
        /* No pagination = exit wrapper */
        finalCb(null, data);
    } else {
        /* pagination will occur! */
        /* Canvas return string of XML, filter to XML tag */
        var link = response.headers.link.split(',').filter((link) => {
            return link.includes('next');
        })[0];
        /* filter <> and other characters out of url */
        if (link == undefined || link.length == 0) {
            finalCb(null, data);
        } else {
            var pageinateUrl = link.split('<')[1].split('>')[0];
            caller(pageinateUrl, finalCb, data, true);
        }
    }
}

/**********************************************************
 * Updates the rateLimit variable using the given response.
 * If no response is provided, a request is made & 
 * updateRateLimit sends the response to itself
 **********************************************************/
function updateRateLimit(response, cb) {
    if (response !== null) {
        /* update rateLimit global variable */
        if (response.headers['x-rate-limit-remaining'] != undefined) {
            rateLimit = response.headers['x-rate-limit-remaining'];
            cb();
        } else {
            /* if unable to get needed... poop. this could easily cause an infinite loop... */
            // updateRateLimit(null, cb);
            cb(new Error('unable to read x-rate-limit-remaining property'));
        }
    } else {
        /* if there is no response get one and try again */
        var derp = {
            method: 'GET',
            url: formatURL('/api/v1/accounts/13'),
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        };
        // TODO should this be included in the apiCounter?
        apiCounter++;
        request.get(derp, (err, response) => {
            if (err)
                cb(err);
            else if (response.statusCode < 200 || response.statusCode >= 300)
                cb(new Error(`Status Code ${response.statusCode}`));
            else
                updateRateLimit(response, cb);
        });
    }
}

/*****************************************
 * sends an API call with the given object
 * All calls come through this function
 *****************************************/
function sendRequest(reqObj, reqCb) {
    apiCounter++;
    /* Send the request */
    request(reqObj, (err, response, body) => {
        if (err) {
            reqCb(err, response, body);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
            reqCb(new Error(`Status Code ${response.statusCode} | ${body}`), response, body);
        } else {
            /* Update the global rateLimit */
            updateRateLimit(response, (updateErr) => {
                if (updateErr) {
                    console.error(updateErr);
                }
                /* parse the body if it's a string */
                if (typeof body === 'string') {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        reqCb(e, response, body);
                    }
                }
                reqCb(null, response, body);
            });
        }
    });
}

/*******************************************************
 * Ensures the RateLimit is above the designated buffer
 * before sending each request. Pauses the queue when
 * the rateLimit gets below the buffer.
 *******************************************************/
function preFlightCheck(reqObj, reqCb) {
    /* is the rateLimit high enough? */
    if (rateLimit >= buffer) {
        /* unpause the queue if needed */
        if (queue.paused) queue.resume();
        sendRequest(reqObj, reqCb);
    } else {
        /* pause the queue if needed */
        if (!queue.paused) {
            queue.pause();
            console.log('Canvas servers are melting. Give them a moment to cool down.');
        }
        /* make a tiny API call to update the rateLimit */
        updateRateLimit(null, (rateErr) => {
            if (rateErr) {
                /* if updating the rateLimit failed, wait 3s and send the request */
                console.error(`Error while updating the rateLimit. Reverting to timeouts. ${rateErr}`);
                setTimeout(() => {
                    queue.resume();
                    sendRequest(reqObj, reqCb);
                }, 30000);
                return;
            }
            setTimeout(() => {
                preFlightCheck(reqObj, reqCb);
            }, 1000);
        });
    }
}

/******************************
 * Adds protocol and domain to 
 * url if missing
 ******************************/
function formatURL(url) {
    if (url.search(/https?:\/\/(?:byui|pathway).instructure.com/) >= 0) {
        return url;
    } else {
        url = `https://${domain}.instructure.com${url}`;
        return url;
    }
}

/*************************************************
 * Takes a url, cb, and an optional obj. Obj must
 * be null if not required. Returns a boolean.
 ************************************************/
function validateParams(url, cb, obj) {
    /* obj is null when not required */
    if (!cb || typeof cb != 'function') {
        throw Error('CB is not a function');
    } else if (!url || typeof url != 'string' || (obj !== null && typeof obj != 'object')) {
        return false;
    } else {
        return true;
    }
}

/* END INTERNAL HELPER FUNCTIONS */


/* START EXTERNAL FUNCTIONS */

/***********************************************
 * GET operation. Returns an Array of results, 
 * even if there is only 1 result
 ***********************************************/
const getRequest = function (url, finalCb, data = [], paginated = false) {
    if (!validateParams(url, finalCb, null)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }

    var getObj = {
        method: 'GET',
        url: formatURL(url),
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    if (paginated) {
        queue.unshift(getObj, callReturned);
    } else {
        queue.push(getObj, callReturned);
    }

    function callReturned(err, response, body) {
        if (err) {
            finalCb(err);
            return;
        }

        data = data.concat(body);
        paginate(response, getRequest, data, finalCb);
    }
};

/****************************************
 * PUT request with params as type FORM
 ****************************************/
const putRequest = function (url, putParams, finalCb) {
    if (!validateParams(url, finalCb, putParams)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }
    var putObj = {
        method: 'PUT',
        url: formatURL(url),
        form: putParams,
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    queue.push(putObj, (err, response, data) => {
        finalCb(err, data);
    });
};


/****************************************************
 * PUT request with params as type Application/JSON
 * request library returns a parsed object
 ***************************************************/
const putJSON = function (url, putParams, finalCb) {
    /* validate args */
    if (!validateParams(url, finalCb, putParams)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }

    var putObj = {
        method: 'PUT',
        url: formatURL(url),
        json: true,
        body: putParams,
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    queue.push(putObj, (err, response, data) => {
        finalCb(err, data);
    });
};


/*****************************************
 * POST request with params as type FORM
 *****************************************/
const postRequest = function (url, postParams, finalCb) {
    if (!validateParams(url, finalCb, postParams)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }

    // url = formatURL(url);
    var postObj = {
        method: 'POST',
        url: formatURL(url),
        form: postParams,
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    queue.push(postObj, (err, response, data) => {
        finalCb(err, data);
    });
};

/****************************************************
 * POST request with params as type Application/JSON
 * request library returns a parsed object
 ***************************************************/
const postJSON = function (url, postParams, finalCb) {
    /* validate args */
    if (!validateParams(url, finalCb, postParams)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }

    var postObj = {
        method: 'POST',
        url: formatURL(url),
        json: true,
        body: postParams,
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    queue.push(postObj, (err, response, data) => {
        finalCb(err, data);
    });
};

/************************************************
 * DELETE operation
 ************************************************/
const deleteRequest = function (url, finalCb) {
    // console.log('API CALLS MADE:', apiCounter);
    if (!validateParams(url, finalCb, null)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }

    var deleteObj = {
        method: 'DELETE',
        url: formatURL(url),
        headers: {
            'Authorization': `Bearer ${auth.token}`
        }
    };

    queue.push(deleteObj, (err, response, data) => {
        finalCb(err, data);
    });
};

/* END CRUD FUNCTIONS */


/**********************************
 * gets all modules using courseId
 **********************************/
const getModules = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/modules`;
    getRequest(url, cb);
};

/*************************************
 * gets all module Items in a module
 ************************************/
const getModuleItems = function (courseId, moduleId, cb) {
    var url = `/api/v1/courses/${courseId}/modules/${moduleId}/items`;
    getRequest(url, cb);
};

/********************************
 * gets all pages using courseId
 ********************************/
const getPages = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/pages`;
    getRequest(url, cb);
};

/**************************************
 * gets all Assignments using courseId
 *************************************/
const getAssignments = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/assignments`;
    getRequest(url, cb);
};

/*********************************************
 * gets all Discussion topics using courseId
 ********************************************/
const getDiscussions = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/discussion_topics`;
    getRequest(url, cb);
};

/*********************************
 * gets all Files using courseId
 ********************************/
const getFiles = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/files`;
    getRequest(url, cb);
};

/***********************************
 * gets all Quizzes using courseId
 **********************************/
const getQuizzes = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/quizzes`;
    getRequest(url, cb);
};

/*************************************
 * gets all Quiz questions in a quiz
 ************************************/
const getQuizQuestions = function (courseId, quizId, cb) {
    var url = `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`;
    getRequest(url, cb);
};

/************************************************
 * overwrites auth.token so the wrapper can be 
 * used by different users in 1 program
 ***********************************************/
function changeAuth(token) {
    auth.token = token;
}

/**********************************************
 * Updates the default domain used by formatURL
 * when no domain is specified
 **********************************************/
function changeDefaultDomain(newDomain) {
    const possibleDomains = ['byui', 'pathway'];
    if (possibleDomains.includes(newDomain)) {
        domain = newDomain;
    } else {
        console.log(`Invalid domain. Domain must match one of the following: ${possibleDomains}`);
    }
}

/* END EXTERNAL FUNCTIONS */


module.exports = {
    apiCount: apiCounter,
    get: getRequest,
    put: putRequest,
    putJSON,
    post: postRequest,
    postJSON,
    delete: deleteRequest,
    getModules,
    getModuleItems,
    getPages,
    getAssignments,
    getDiscussions,
    getFiles,
    getQuizzes,
    getQuizQuestions,
    changeUser: changeAuth,
    changeDomain: changeDefaultDomain
};