/*eslint-env node, es6*/
/*eslint no-unused-vars:1*/
/*eslint no-console:0*/

/* ../../ so it can be used in a module */
const auth = require('../../auth.json');
const request = require('request');

var cache = [];
var apiCounter = 0;
var cacheCounter = 0;

// Always set per_page? 

/* START INTERNAL HELPER FUNCTIONS */

/******************************
 * Adds protocol and domain to 
 * url if missing
 ******************************/
function urlCleaner(url) {
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
function paginate(response, caller, data, cb) {
    if (response.headers.link == undefined) {
        /* No pagination = exit wrapper */
        cb(null, data);
    } else {
        /* pagination will occur! */
        /* Canvas return string of XML, filter to XML tag */
        var link = response.headers.link.split(',').filter((link) => {
            return link.includes('next');
        })[0];
        /* filter <> and other characters out of url */
        if (link == undefined || link.length == 0) {
            cb(null, data);
        } else {
            var pageinateUrl = link.split('<')[1].split('>')[0]
            caller(pageinateUrl, cb, data);
        }
    }
}

/***********************************************
 * checks the x-rate-limit-remaining param 
 * to ensure we don't get a 403 from throttling
 ***********************************************/
function checkRequestsRemaining(response, cb) {
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
    if (!cb || typeof cb != "function") {
        throw Error('CB is not a function');
    } else if (!url || typeof url != 'string' || (obj !== null && typeof obj != "object")) {
        return false;
    } else {
        return true;
    }
}

/**************************************************
 * ADD DESCRIPTION
 * 
 ***************************************************/
function hasId(url) {
    return /\/\d+($|\?)/g.test(url);
}


/* END INTERNAL HELPER FUNCTIONS */


/* START EXTERNAL FUNCTIONS */

/* START CRUD FUNCTIONS */

/*************************************************
 * GET operation. returns err, data
 * DOES NOT exit the wrapper unless an err occurs
 *************************************************/
const getRequest = function (url, cb, data = []) {
    if (!validateParams(url, cb, null)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = urlCleaner(url);

    var useCache = hasId(url);
    if (useCache == true) {
        /* There will be no pagination!!! */
        /* check Cache */
        var storedCall = cache.find((call) => {
            return call.url == url;
        });

        /* Return Cached value if found */
        if (storedCall !== undefined) {
            cacheCounter++;
            console.log('PREVENTED API CALLS:', cacheCounter);
            cb(null, storedCall.body);
            return;
        }
    }

    request.get(url, (err, response, body) => {
        apiCounter++;
        console.log('API CALLS MADE:', apiCounter);
        if (err) {
            cb(err, null);
            return;
        } else if (response.statusCode !== 200) {
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
            data = data.concat(body);

            /* Update Cache IF request has an ID*/
            if (useCache == true) {
                cache.unshift({
                    'type': 'GET',
                    'url': url,
                    'body': data
                });
            }

            paginate(response, getRequest, data, cb);
        });
    }).auth(null, null, true, auth.token);
}

/*******************************************
 * PUT request. requires a url & putObject
 * returns err, response
 ******************************************/
const putRequest = function (url, putObj, cb) {
    apiCounter++;
    console.log('API CALLS MADE:', apiCounter);
    var useCache;
    if (!validateParams(url, cb, putObj)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = urlCleaner(url);
    useCache = hasId(url);

    request.put({
        url: url,
        form: putObj
    }, (err, response, body) => {
        if (err) {
            cb(err, response);
            return;
        } else if (response.statusCode !== 200) {
            console.log(`Status Code: ${response.statusCode} | ${response.body}`);
            cb(new Error(`Status Code: ${response.statusCode} | ${ response.body }`));
            return;
        }

        checkRequestsRemaining(response, () => {
            try {
                body = JSON.parse(body);
            } catch (e) {
                cb(e, null);
                return;
            }

            /* save to cache when done */
            if (useCache == true) {
                cache.unshift({
                    'type': 'PUT',
                    'url': url,
                    'body': body
                });
            }

            cb(null, body);
        });
    }).auth(null, null, true, auth.token);
}

/****************************************
 * POST request. takes URL and postObj.
 * returns err, response
 ***************************************/
const postRequest = function (url, postObj, cb) {
    apiCounter++;
    console.log('API CALLS MADE:', apiCounter);
    if (!validateParams(url, cb, postObj)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = urlCleaner(url);
    var useCache = hasId(url);
    request.post({
        url: url,
        form: postObj
    }, (err, response, body) => {
        if (err) {
            cb(err, null);
            return;
        } else if (response.statusCode !== 200) {
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

            /* save to cache when done */
            if (useCache == true) {
                cache.unshift({
                    'type': 'POST',
                    'url': url,
                    'body': body
                });
            }

            cb(null, body);
        });
    }).auth(null, null, true, auth.token);

}

/************************************************
 * DELETE operation. returns err, response.
 * no pagination
 ************************************************/
const deleteRequest = function (url, cb) {
    apiCounter++;
    console.log('API CALLS MADE:', apiCounter);
    if (!validateParams(url, cb, null)) {
        cb(new Error('Invalid parameters sent'));
        return;
    }
    url = urlCleaner(url);
    request.delete(url, (err, response, body) => {
        if (err) {
            cb(err, response);
            return;
        } else if (response.statusCode !== 200) {
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
}

/* END CRUD FUNCTIONS */


/**********************************
 * gets all modules using courseId
 **********************************/
const getModules = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/modules`;
    getRequest(url, cb);
}

/*************************************
 * gets all module Items in a module
 ************************************/
const getModuleItems = function (courseId, moduleId, cb) {
    var url = `/api/v1/courses/${courseId}/modules/${moduleId}/items`;
    getRequest(url, cb);
}

/********************************
 * gets all pages using courseId
 ********************************/
const getPages = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/pages`;
    getRequest(url, cb);
}

/**************************************
 * gets all Assignments using courseId
 *************************************/
const getAssignments = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/assignments`;
    getRequest(url, cb);
}

/*********************************************
 * gets all Discussion topics using courseId
 ********************************************/
const getDiscussions = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/discussion_topics`;
    getRequest(url, cb);
}

/*********************************
 * gets all Files using courseId
 ********************************/
const getFiles = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/files`;
    getRequest(url, cb);
}

/***********************************
 * gets all Quizzes using courseId
 **********************************/
const getQuizzes = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/quizzes`;
    getRequest(url, cb);
}

/*************************************
 * gets all Quiz questions in a quiz
 ************************************/
const getQuizQuestions = function (courseId, quizId, cb) {
    var url = `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`;
    getRequest(url, cb);
}

/* END EXTERNAL FUNCTIONS */

module.exports = {
    get: getRequest,
    put: putRequest,
    post: postRequest,
    delete: deleteRequest,
    getModules: getModules,
    getModuleItems: getModuleItems,
    getPages: getPages,
    getAssignments: getAssignments,
    getDiscussions: getDiscussions,
    getFiles: getFiles,
    getQuizzes: getQuizzes,
    getQuizQuestions: getQuizQuestions
}