/*eslint-env node, es6 */
/*eslint no-console:0 */

const canvas = require('./canvas.js');
const auth = require('./auth.json').token;

canvas.changeUser(auth);

/* GET with pagination */
function noPaginate() {
    canvas.get('/api/v1/accounts/13/courses', (err, courses) => {
        if (err) {
            console.error(`ERR: ${err}`);
            return;
        }

        console.log(`GET with pagination ${courses.length}`);
        return;
    });
}

/* GET without pagination */
function paginate() {
    canvas.get('/api/v1/accounts/13', (err, user) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log(`GET without pagination ${user}`);
        return;
    });
}

/* basic PUT */
function put() {
    canvas.put('/api/v1/courses/92/pages/how%20to%20understand%20due%20dates', { 'wiki_page[front_page]': true }, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        // console.log(data);
        console.log('put worked');
    });
}

/* PUT as type JSON */
function putJSON() {
    canvas.put('/api/v1/courses/92/modules/923', {'module[name]': 'I\'ve been renamed'}, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}

/* basic POST */
function post() {
    canvas.post('/api/v1/courses/92/modules', { 'module[name]': 'testModule2' }, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}

/* post as type JSON */
function postJSON() {
    canvas.postJSON('', {}, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}

/* basic delete */
function deleteReq() {
    canvas.delete('/api/v1/courses/92/modules/924', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(data);
    });
}



// paginate();
// noPaginate();
// put(); // works
putJSON();
// post(); // works
// postJSON();
// deleteReq(); // works


// canvas.getModules(2034, (err, moduels) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${moduels.length} modules`);
//     return;
// });

// canvas.getPages(2034, (err, pages) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${pages.length} pages`)
// });

// canvas.getAssignments(2034, (err, assignments) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${assignments.length} assignments`)
// });

// canvas.getDiscussions(2034, (err, discussions) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${discussions.length} discussions`)
// });

// canvas.getFiles(2034, (err, files) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${files.length} files`)
// });

// canvas.getQuizzes(2034, (err, quizzes) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log(`Found ${quizzes.length} quizzes`)
// });