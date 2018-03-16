/**********************************************
 * Calculates elapsed time. Takes a start time
 **********************************************/
module.exports = (startTime) => {
    var end = new Date();
    /* create elapsed time */
    var seconds = (end - startTime) / 1000,
        minutes = 0,
        hours = 0,
        elapsedTime = '';
    /* calculate minutes */
    if (seconds >= 60) {
        minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
    }
    /* format seconds */
    if (seconds < 10)
        seconds = '0' + seconds;
    /* calculate hours */
    if (minutes >= 60) {
        hours = Math.floor(minutes / 60);
        minutes = Math.floor(minutes % 60);
    }
    /* format minutes */
    if (minutes < 10)
        minutes = '0' + minutes;
    /* format hours */
    if (hours < 10)
        hours = '0' + hours;

    elapsedTime += hours + ':' + minutes + ':' + seconds;
    return elapsedTime;
};