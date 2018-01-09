/*eslint-env node, es6 */
/*eslint no-console:0 */

const canvas = require('./canvas.js');


/*canvas.get(`/api/v1/accounts`, err => {
    if (err) {
        console.error(err);
        return
    }
    console.log('done');
});*/


/*canvas.getModules(2034, (err, moduels) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${moduels.length} modules`);
    return;
});*/

/*
canvas.get("2034", {}, (err, moduels) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${moduels.length} modules`);
    return;
});
*/


canvas.getPages(2034, (err, pages) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${pages.length} pages`)
});

canvas.getAssignments(2034, (err, assignments) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${assignments.length} assignments`)
});

canvas.getDiscussions(2034, (err, discussions) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${discussions.length} discussions`)
});

canvas.getFiles(2034, (err, files) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${files.length} files`)
});

canvas.getQuizzes(2034, (err, quizzes) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Found ${quizzes.length} quizzes`)
});