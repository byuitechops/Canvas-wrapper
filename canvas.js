/* eslint no-console:0 */
var auth = null;

if (process.env.CANVAS_API_TOKEN === undefined) {
    throw new Error('CANVAS_API_TOKEN enviroment variable is empty.');
} else {
    auth = process.env.CANVAS_API_TOKEN;
}

const request = require('request');
const asyncLib = require('async');
const fs = require('fs');

/* SETTINGS */
var domain = 'byui'; // default to byui
var apiCount = 0; // counts api calls made
var rateLimit = 700; // used for throttling. 700 is the max value
var concurrency = 20; // max number of operations running at any one time
const buffer = 150; // once the rateLimit passes this point we pause the queue
var queue = asyncLib.queue(preFlightCheck, concurrency);

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
    if (response !== null && response.headers['x-rate-limit-remaining'] !== undefined) {
        /* update rateLimit global variable */
        rateLimit = response.headers['x-rate-limit-remaining'];
        cb();
    } else {
        /* if there is no response OR x-rate-limit-remaining header get one and try again */
        var tinyRequest = {
            method: 'GET',
            url: formatURL('/api/v1/accounts/19'),
            headers: {
                'Authorization': `Bearer ${auth}`
            }
        };
        apiCount++;
        request.get(tinyRequest, (err, response) => {
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
    apiCount++;
    /* Send the request */
    request(reqObj, (err, response, body) => {
        if (err) {
            reqCb(err, response, body);
            return;
        } else if (Math.floor(response.statusCode / 100) === 3) { /* on redirect */
            reqCb(null, response, null);
            return;
        }
        
        var jsonResponse = null;
        if (response.headers['content-type']) {
            jsonResponse = response.headers['content-type'].split(';')[0] === 'application/json';
        }
        
        if (Math.floor(response.statusCode / 100) !== 2) { /* if status code is not in the 200's */
            /* only append body to the error if it's JSON (so we don't have a full HTML page in the error) */
            if (jsonResponse && typeof body !== 'string') reqCb(new Error(`Status Code ${response.statusCode} | ${reqObj.method} | ${reqObj.url} | ${JSON.stringify(body)}`), response, body);
            else if (jsonResponse && typeof body === 'string') reqCb(new Error(`Status Code ${response.statusCode} | ${reqObj.method} | ${reqObj.url} | ${body}`), response, body);
            else reqCb(new Error(`Status Code ${response.statusCode} | ${reqObj.method} | ${reqObj.url}`), response, body);
        } else { /* if valid! */
            /* Update the global rateLimit */
            updateRateLimit(response, (updateErr) => {
                if (updateErr) {
                    console.error(updateErr.message);
                }

                /* parse the body if it's JSON */
                if (jsonResponse && typeof body === 'string') {
                    try {
                        body = JSON.parse(body);
                    } catch (e) {
                        reqCb(e, response, body);
                        return;
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
    if (url.search(/https?:\/\/(?:byui|pathway).instructure.com/) >= 0 || url === 'https://instructure-uploads.s3.amazonaws.com') {
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
    } else if (!url || typeof url != 'string' || obj !== null && typeof obj != 'object') {
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
            'Authorization': `Bearer ${auth}`
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
            'Authorization': `Bearer ${auth}`
        }
    };

    queue.push(putObj, (err, response, data) => {
        if (err) finalCb(err, data);
        else finalCb(null, data);
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
            'Authorization': `Bearer ${auth}`
        }
    };

    queue.push(putObj, (err, response, data) => {
        if (err) finalCb(err, data);
        else finalCb(null, data);
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

    var postObj = {
        method: 'POST',
        url: formatURL(url),
        form: postParams,
        headers: {
            'Authorization': `Bearer ${auth}`
        }
    };

    queue.push(postObj, (err, response, data) => {
        if (err) finalCb(err, data);
        else finalCb(null, data);
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
            'Authorization': `Bearer ${auth}`
        }
    };

    queue.push(postObj, (err, response, data) => {
        if (err) finalCb(err, data);
        else finalCb(null, data);
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
            'Authorization': `Bearer ${auth}`
        }
    };

    queue.push(deleteObj, (err, response, data) => {
        if (err) finalCb(err, data);
        else finalCb(null, data);
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

/************************************
 * gets all pages including the HTML
 ************************************/
const getPages = function (courseId, cb) {
    var url = `/api/v1/courses/${courseId}/pages`;
    getRequest(url, cb);
};

const getFullPages = function (courseId, cb) {
    function getAPage(page, mapCB) {
        getRequest(`/api/v1/courses/${courseId}/pages/${page.page_id}`, (pageErr, page) => {
            if (pageErr) {
                mapCB(pageErr, page);
                return;
            }
            mapCB(null, page);
        });
    }

    getPages(courseId, (pagesErr, pages) => {
        if (pagesErr) {
            cb(pagesErr, pages);
            return;
        }

        asyncLib.mapLimit(pages, concurrency / 2, getAPage, (fullPageErr, fullPages) => {
            if (fullPageErr) {
                cb(fullPageErr, fullPages);
                return;
            }
            cb(null, fullPages);
        });
    });
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
 * overwrites auth so the wrapper can be 
 * used by different users in 1 program
 ***********************************************/
const setAuth = (newToken) => {
    auth = newToken;
};

/**********************************************
 * Updates the default domain used by formatURL
 * when no domain is specified
 **********************************************/
const setDefaultDomain = (newDomain) => {
    const possibleDomains = ['byui', 'pathway'];
    if (possibleDomains.includes(newDomain)) {
        domain = newDomain;
    } else {
        console.log(`Invalid domain. Domain must match one of the following: ${possibleDomains}`);
    }
};

/**********************************************
 * Updates the concurrent calls of the queue
 ********************************************/
const setConcurrency = (newLimit) => {
    if (newLimit <= 50) {
        queue.concurrency = newLimit;
    } else {
        console.log('Invalid Concurrency. Concurrency must not be above 50');
    }
};

const startCourseUpload = (canvasOU, filePath, finalCb) => {
    /************************************************
     * Step 3 of the course upload dance
     * Confirm upload, send migration back to user
     ************************************************/
    function confirmUpload(response, migration) {
        postRequest(response.headers.location, {}, (err, response, body) => {
            if (err) {
                finalCb(err, null);
                return;
            }

            finalCb(null, migration, response);
        });
    }

    /*****************************************************************
     * Step 2 of the course upload dance
     * Upload file as a MULTIPART/FORM request without authentication
     *****************************************************************/
    function uploadZip(migrationBody) {
        var preAttachment = migrationBody.pre_attachment;
        preAttachment.upload_params.file = fs.createReadStream(filePath);

        var postObj = {
            method: 'POST',
            url: formatURL(preAttachment.upload_url),
            formData: preAttachment.upload_params,
        };
        /* make a MULTIPART request to  */
        queue.push(postObj, (err, response, data) => {
            if (err) {
                finalCb(err, null);
                return;
            }
            confirmUpload(response, migrationBody);
        });
    }

    /************************************************
     * Step 1 of the course upload dance
     * Create migration & upload request
     ************************************************/
    var fileName = filePath.split('\\')[filePath.split('\\').length - 1],
        url = `/api/v1/courses/${canvasOU}/content_migrations`,
        form = {
            migration_type: 'd2l_exporter',
            'pre_attachment[name]': fileName,
            'pre_attachment[content_type]': 'application/zip'
        };
    // pre_attachment is only added when uploading a course
    postRequest(url, form, (err, migration) => {
        if (err) {
            finalCb(err, null);
            return;
        }
        uploadZip(migration);
    });
};

/********************************
 * returns the apiCount variable
 *******************************/
const getApiCount = function () {
    return apiCount;
};

/* END EXTERNAL FUNCTIONS */


module.exports = {
    apiCount: getApiCount,
    get: getRequest,
    put: putRequest,
    putJSON,
    post: postRequest,
    postJSON,
    delete: deleteRequest,
    getModules,
    getModuleItems,
    getPages,
    getFullPages,
    getAssignments,
    getDiscussions,
    getFiles,
    getQuizzes,
    getQuizQuestions,
    uploadCourse: startCourseUpload,
    changeUser: setAuth,
    changeDomain: setDefaultDomain,
    changeConcurrency: setConcurrency
};