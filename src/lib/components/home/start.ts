// The fixed text of the start page: what Concordans promises, the field and three questions it
// answers. One source for the app and for the server's HTML of `/` (the
// first paint, home.py of the back end): the build puts start.json beside index.html, and a
// test keeps the server's copy (start-server.html) equal to it.
import start from './start.json';

export const START = start;
