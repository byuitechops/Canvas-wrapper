/*eslint no-console:0*/

/* ../../ so it can be used in a module */
try {
    auth = require('../../auth.json');
} catch (e) {
    auth = { token: '' };
}
// var auth = require('./auth.json');
const request = require('request');

var apiCounter = 0;
var auth;
var throttle = 500;

// Always set per_page? 

/* START INTERNAL HELPER FUNCTIONS */

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
            caller(pageinateUrl, finalCb, data);
        }
    }
}

/***********************************************
 * checks the x-rate-limit-remaining param 
 * to ensure we don't get a 403 from throttling
 ***********************************************/
function checkRequestsRemaining(response, cb) {
    // throttle = response.headers['x-rate-limit-remaining'] < 200;
    if (response.headers['x-rate-limit-remaining'] < 150) {
        // console.log(response.headers['x-rate-limit-remaining']);
        console.log('Canvas servers are melting. Give them a minute to cool down.');
        setTimeout(cb, 10000);
    } else {
        cb();
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


function sendRequest(reqObj, cb) {

    apiCounter++;

    /* Send the request */
    request(reqObj, (err, response, body) => {
        /* Check the throttle and wait if needed */
        checkRequestsRemaining(response, () => {
            if (err) {
                cb(err, response, body);
            } else if (response.statusCode < 200 || response.statusCode >= 300) {
                cb(new Error(`Status Code ${response.statusCode} | ${body}`), response, body);
            } else {
                /* parse the body if it's a string */
                if (typeof body === 'string') {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        cb(e, response, body);
                    }
                }
                cb(null, response, body);
            }
        });
    });
}

/* END INTERNAL HELPER FUNCTIONS */


/* START EXTERNAL FUNCTIONS */

/*************************************************
 * GET operation. returns err, data
 * DOES NOT exit the wrapper unless an err occurs
 *************************************************/
const getRequest = function (url, finalCb, data = []) {
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

    sendRequest(getObj, (err, response, body) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        data = data.concat(body);
        paginate(response, getRequest, data, finalCb);
    });
};

/*******************************************
 * PUT request. requires a url & putObject
 * returns err, response
 ******************************************/
const putRequest = function (url, putParams, finalCb) {
    if (!validateParams(url, finalCb, putParams)) {
        finalCb(new Error('Invalid parameters sent'));
        return;
    }
    var putObj = {
        url: formatURL(url),
        method: 'PUT',
        form: putParams,
        headers: {
            'x-api-token': auth.token
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

/****************************************
 * POST request. takes URL and postObj.
 * returns err, response
 ***************************************/
const postRequest = function (url, postObj, cb) {
    if (!validateParams(url, cb, postObj)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }

    url = formatURL(url);
    var settings = {
        url: url,
        form: postObj
    };

    post(settings, (err, response, body) => {
        if (err) {
            cb(err, null);
            return;
        }
        /* parse JSON response */
        try {
            body = JSON.parse(body);
        } catch (e) {
            cb(e, null);
            return;
        }

        cb(null, body);
    });
};

/************************************************
 * POSTJSON returns err, response
 * no pagination
 ***********************************************/
const postJSON = function (url, postObj, cb) {
    /* validate args */
    if (!validateParams(url, cb, postObj)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = formatURL(url);

    var settings = {
        url: url,
        json: true,
        body: postObj
    };

    post(settings, (err, response, body) => {
        if (err) {
            cb(err, null);
            return;
        }
        /* parse the body if a string is returned. Normally returns an object */
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                cb(e, null);
                return;
            }
        }

        cb(null, body);
    });
};

/*********************************************
 * Makes a POST request. Abstracted by 
 * postRequest and postJSON
 *********************************************/
function post(settings, wrapperCb) {
    apiCounter++;

    /* make the post request */
    request.post(settings, (err, response, body) => {
        /* err if needed */
        if (err) {
            wrapperCb(err, response, body);
            return;
        } else if (response.statusCode > 300 || response.statusCode < 200) {
            wrapperCb(new Error(`Status Code: ${response.statusCode} | ${response.body}`), response, body);
            return;
        }

        checkRequestsRemaining(response, () => {
            wrapperCb(null, response, body);
        });

    }).auth(null, null, true, auth.token);
}


/************************************************
 * DELETE operation. returns err, response.
 * no pagination
 ************************************************/
const deleteRequest = function (url, cb) {
    // console.log('API CALLS MADE:', apiCounter);
    if (!validateParams(url, cb, null)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = formatURL(url);

    apiCounter++;
    request.delete(url, (err, response, body) => {
        if (err) {
            cb(err, response);
            return;
        } else if (response.statusCode > 300 || response.statusCode < 200) {
            cb(new Error(`Status Code: ${response.statusCode} | ${response.body}`));
            return;
        }

        checkRequestsRemaining(response, () => {
            try {
                body = JSON.parse(body);
            } catch (e) {
                cb(e, null);
                return;
            }
            cb(null, body);
        });
    }).auth(null, null, true, auth.token);
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
    // putJSON: putJOSN,
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
