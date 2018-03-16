/*eslint no-console:0*/

/* ../../ so it can be used in a module */
try {
    auth = require('../../auth.json');
} catch (e) {
    auth = { token: '' };
}
// var auth = require('./auth.json');
const request = require('request');
const asyncLib = require('async');

var apiCounter = 0;
var auth;
var rateLimit = 500;
var queue = asyncLib.queue(preFlightCheck, 20);

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

/****************************************
 * 
 ****************************************/
function updateRateLimit(response, cb) {
    /* if there is no response get one and try again */
    if (response === null) {
        request.get('api/v1/', (err, response) => {
            updateRateLimit(response, cb);
        });
    } else {
        if (response.headers['x-rate-limit-remaining'] < 150 != undefined) {
            rateLimit = response.headers['x-rate-limit-remaining'];
        }
        cb();
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
        /* Check the rateLimit and wait if needed */
        updateRateLimit(response, () => {
            if (err) {
                reqCb(err, response, body);
            } else if (response.statusCode < 200 || response.statusCode >= 300) {
                reqCb(new Error(`Status Code ${response.statusCode} | ${body}`), response, body);
            } else {
                /* parse the body if it's a string */
                if (typeof body === 'string') {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        reqCb(e, response, body);
                    }
                }
                reqCb(null, response, body);
            }
        });
    });
}

/*****************************************
 * 
 * 
 *****************************************/
function preFlightCheck(reqObj, reqCb) {
    if (rateLimit >= 150) {
        sendRequest(reqObj, reqCb);
    } else {
        console.log('Canvas servers are melting. Give them a moment to cool down.');
        setTimeout(() => {
            updateRateLimit(null, () => {
                // preFlightCheck(reqObj, reqCb);
                queue.unshift(reqObj, reqCb);
            });
        }, 10000);
        queue.unshift(reqObj, reqCb);
    }
}

/******************************
 * Adds protocol and domain to 
 * url if missing
 ******************************/
function formatURL(url) {
    if (url.search(/https?:\/\/byui.instructure.com/) >= 0) {
        return url;
    } else {
        url = `https://byui.instructure.com${url}`;
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

    /* sendRequest(getObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        data = data.concat(body);
        paginate(response, getRequest, data, finalCb);
    }); */
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

    sendRequest(putObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        finalCb(null, body);
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

    sendRequest(putObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        finalCb(null, body);
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

    sendRequest(postObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        finalCb(null, body);
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

    sendRequest(postObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        finalCb(null, body);
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

    sendRequest(deleteObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        finalCb(null, body);
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

/* END EXTERNAL FUNCTIONS */


module.exports = {
    apiCount: apiCounter,
    get: getRequest,
    put: putRequest,
    putJSON: putJSON,
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
    changeUser: changeAuth
};
