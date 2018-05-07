/*eslint-env node, es6 */
/*eslint no-console:0 */

const canvas = require('./canvas.js');
const chalk = require('chalk');
// const auth = require('./auth.json').token;
const calcElapsedTime = require('./elapsedTime.js');
// canvas.changeUser(auth);

/* GET with pagination */
function noPaginate() {
    var startTime = new Date();
    canvas.get('/api/v1/accounts/', (err, accounts) => {
        if (err) {
            console.error(`ERR: ${err}`);
            return;
        }

        console.log(`\nGET without pagination\nAccounts retrieved: ${accounts.length}. Elapsed time: ${calcElapsedTime(startTime)}`);
        return;
    });
}

/* GET without pagination */
function paginate() {
    var startTime = new Date();
    canvas.get('/api/v1/accounts/13/courses', (err, courses) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log(`\nGET with pagination\nCourses retrieved: ${courses.length}. Elapsed time: ${calcElapsedTime(startTime)}`);
        return;
    });
}

/* basic PUT */
function put() {
    // canvas.put('/api/v1/courses/92/pages/how%20to%20understand%20due%20dates', { 'wiki_page[front_page]': true }, (err, data) => {
    // canvas.put('/api/v1/courses/92/modules/923', {
    canvas.put('/api/v1/courses/92/modules/7', {
        'module[name]': 'I\'ve been renamed'
    }, (err, data) => {
        if (err) {
            console.error(chalk.red(err));
            console.log(chalk.yellow('PUT broke'));
            return;
        }
        // console.log(data);
        console.log(chalk.green('put worked'));
    });
}

/* PUT as type JSON */
function putJSON() {
    /*  var putObj = {
        module : {
            name: 'My name got chnaged'
        }
    }; */
    var anotherPutObj = {
        'module[name]': 'I\'ve been renamed'
    };

    canvas.putJSON('/api/v1/courses/92/modules/923', anotherPutObj , (err, data) => {
        if (err) {
            console.error(chalk.red(err));
            console.log(chalk.yellow('PUT JSON broke'));
            return;
        }
        // console.log(data);
        console.log(chalk.green('putJSON worked'));
    });
}

/* basic POST */
function post() {
    canvas.post('/api/v1/courses/92/modules', {
        'module[name]': 'testModule2'
    }, (err, data) => {
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


function getAllDaPages(courseId) {
    canvas.getFullPages(courseId, (err, pages) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Success');
        console.log(`Got ${pages.length} pages`);
    });
}


// getAllDaPages(11378);
// paginate();
// noPaginate();
put();
// putJSON();
// post();
// postJSON();
// deleteReq();


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