# PDF.js

PDF.js is a Portable Document Format (PDF) viewer that is built with HTML5.

[Overview](https://www.overviewdocs.com) maintains this pdf.js fork. See
[the original Mozilla project](https://github.com/mozilla/pdf.js) for more
documentation.

## Online demo

TKTK

## Getting the Code

To get a local copy of the current code, clone it using git:

    $ git clone git://github.com/overview/overview-pdf-viewer.git
    $ cd overview-pdf-viewer

Next, install Node.js via the [official package](http://nodejs.org) or via
[nvm](https://github.com/creationix/nvm). You need to install the gulp package
globally (see also [gulp's getting started](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md#getting-started)):

    $ npm install -g gulp-cli

If everything worked out, install all dependencies for PDF.js:

    $ npm install

Finally you need to start a local web server as some browsers do not allow opening
PDF files using a file:// URL. Run

    $ gulp server

and then you can open

+ http://localhost:8888/web/viewer.html

It is also possible to view all test PDF files on the right side by opening

+ http://localhost:8888/test/pdfs/?frame

## Building PDF.js

In order to bundle all `src/` files into two production scripts and build the generic
viewer, run:

    $ gulp generic

This will generate `pdf.js` and `pdf.worker.js` in the `build/generic/build/` directory.
Both scripts are needed but only `pdf.js` needs to be included since `pdf.worker.js` will
be loaded by `pdf.js`. The PDF.js files are large and should be minified for production.
