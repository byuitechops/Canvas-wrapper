/*eslint-env node, es6 */
/*eslint no-console:0 */

const canvas = require('./canvas.js');
const auth = require('./auth.json').token;

canvas.changeUser(auth);

/* GET with pagination */
canvas.get('/api/v1/accounts/13/courses', (err, courses) => {
    if (err) {
        console.error(`ERR: ${err}`);
        return;
    }

    console.log(courses.length);
    return;
});

/* GET without pagination */
// canvas.get('/api/v1/accounts/13', (err, user) => {
//     if (err) {
//         console.error(err);
//         return;
//     }

//     console.log(user);
//     return;
// });


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