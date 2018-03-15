/*eslint-env node, es6 */
/*eslint no-console:0 */

const canvas = require('./canvas.js');
const auth = require('./auth.json').token;

canvas.changeUser(auth);

/* GET with pagination */
const noPaginate = canvas.get('/api/v1/accounts/13/courses', (err, courses) => {
    if (err) {
        console.error(`ERR: ${err}`);
        return;
    }

    console.log(`GET with pagination ${courses.length}`);
    return;
});

/* GET without pagination */
const paginate = canvas.get('/api/v1/accounts/13', (err, user) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log(`GET without pagination ${user}`);
    return;
});

/* basic PUT */
const put = canvas.put('', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
});

/* PUT as type JSON */
// const putJSON = canvas.put('', (err, data) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
// });

/* basic POST */
const post = canvas.post('', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
});

/* post as type JSON */
const postJSON = canvas.postJSON('', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
});

/* basic delete */
const deleteReq = canvas.delete('', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
});


paginate();
noPaginate();
put();
// putJSON();
post();
postJSON();
deleteReq();


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