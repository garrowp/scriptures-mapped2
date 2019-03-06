/*
* FILE:     scriptures.js
* AUTHOR:   Peter Garrow
* Date:     Winter 2019
*
* DESCRIPTION: Front-end JavaScript code for The Scriptures, Mapped.
                IS 542, Winter 2019, Byu.
*
*/
/*property
    Animation, DROP, LatLng, Marker, animation, books, color, fontWeight,
    forEach, fullName, gridName, hash, includes, innerHTML, label, lat, lng,
    log, map, maps, maxBookId, minBookId, numChapters, onerror, onload, open,
    parse, position, push, querySelector, responseText, send, setMap, status,
    strokeColor, text, title
*/
/*global console, google, map, window */
/*jslint
    browser: true
    long: true
*/

const scriptures = (function () {
    "use strict";

    /*---------------------------------------------------------------
    *                       CONSTANTS
    */
   const INDEX_PLACENAME =  2;
   const INDEX_LATITUDE = 3;
   const INDEX_LONGITUDE = 4;
   const INDEX_PLACE_FLAG = 11;
   const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
   const MAX_RETRY_DELAY = 5000;
   const REQUEST_GET = "GET";
   const REQUEST_STATUS_OK = 200;
   const REQUEST_STATUS_ERROR = 400;
   const SCRIPTURES = `<span>
                            <a onclick="changeHash()">The Scriptures</a>
                        </span>`;
   const SCRIPTURES_URL = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";
   const TRANSITION_LIMIT = 3;

    /*---------------------------------------------------------------
    *                       PRIVATE VARIABLES
    */
    let books;
    let gmMarkers = [];
    let next_chap = false;
    let prev_chap = false;
    let retryDelay = 500;
    let transitions = 0;
    let volumes;

    /*---------------------------------------------------------------
    *                       PRIVATE METHOD DECLARATIONS
    */
   let addMarker;
   let ajax;
   let bookChapterValid;
   let cacheBooks;
   let changeHash;
   let clearMarkers;
   let encodedScriptureUrlParameters;
   let generateBreadcrumb;
   let getCrumbBook;
   let getCrumbChapter;
   let getCrumbVolume;
   let getNextCallback;
   let getPrevCallback;
   let getScriptureCallback;
   let getScriptureFailed;
   let hideNextPrev;
   let init;
   let navigateBook;
   let navigateChapter;
   let navigateHome;
   let nextChapter;
   let onHashChanged;
   let previousChapter;
   let setupBounds;
   let setupMarkers;
   let showLocation;
   let showNextPrev;
   let titleForBookChapter;
   let transitionComplete;

    /*---------------------------------------------------------------
    *                       PRIVATE METHODS
    */

    addMarker = function (placename, latitude, longitude) {
        let duplicates = false;
        let myLatLng = new google.maps.LatLng(latitude, longitude);

        gmMarkers.forEach((marker) => {
            if (Math.abs(marker.position.lat() - myLatLng.lat()) < 0.0000001 && Math.abs(marker.position.lng() - myLatLng.lng()) < 0.0000001) {
                if (!marker.title.includes(placename)) {
                    marker.title += `, ${placename}`;
                }
                duplicates = true;
            }
        });

        if (!duplicates) {

            let marker = new google.maps.Marker({
                position: {lat: latitude, lng: longitude},
                map,
                title: placename,
                label: {
                    color: '#201000',
                    strokeColor: '#fff8f0',
                    fontWeight: 'bold',
                    text: placename
                  },
                animation: google.maps.Animation.DROP
            });

            gmMarkers.push(marker);
        }
    };

    ajax = function (url, successCallback, failureCallback, skipParse) {
        let request = new XMLHttpRequest();

        request.open(REQUEST_GET, url, true);
        request.onload = function() {
            if (request.status >= REQUEST_STATUS_OK && request.status < REQUEST_STATUS_ERROR) {
                let data = skipParse ? request.responseText : JSON.parse(request.responseText);

                if (typeof successCallback === "function") {
                    successCallback(data);
                }
            } else {
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };

        request.onerror = failureCallback;
        request.send();
    };

    bookChapterValid = function(bookId, chapter) {
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };

    cacheBooks = function (callback) {
        volumes.forEach((volume) => {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };

    changeHash = function (volumeId, bookId, chapter) {
        let newHash = "";

        if (volumeId !== undefined) {
            newHash += volumeId;

            if (bookId !== undefined) {
                newHash += `:${bookId}`;

                if (chapter !== undefined) {
                    newHash += `:${chpater}`;
                }
            }
        }

        location.hash = newHash;
    };

    clearMarkers = function () {
        gmMarkers.forEach((marker) => {
            marker.setMap(null);
        });

        gmMarkers = [];
    };

    encodedScriptureUrlParameters = function(bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";

            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined && isJst) {
                options += '&jst=JST';
            }

            return `${SCRIPTURES_URL}?book=${bookId}&chap=${chapter}&verses${options}`;
        }
    };

    generateBreadcrumb = function(volumeId, bookId, chapter) {
        let breadcrumb = document.querySelector('#crumb');

        breadcrumb.innerHTML = SCRIPTURES;

        if (volumeId) {
            breadcrumb.innerHTML += `> ${getCrumbVolume(volumeId)}`;
        }

        if (bookId) {
            breadcrumb.innerHTML += `> ${getCrumbBook(volumeId, bookId)}`;
        }

        if (chapter) {
            breadcrumb.innerHTML += `> ${getCrumbChapter(volumeId, bookId, chapter)}`;
        }
    };

    getCrumbBook = function(volumeId, bookId) {
        let book = books[bookId];
        return `<span>
            <a onclick="changeHash(${volumeId}, ${bookId})">${book.gridName}</a>
        </span>`;
    };

    getCrumbChapter = function(volumeId, bookId, chapter) {
        return `<span>
            ${chapter}
        </span>`;
    };

    getCrumbVolume = function(volumeId) {
        let volume = volumes[volumeId - 1];
        return `<span>
                    <a onclick="changeHash(${volumeId})">${volume.gridName}</a>
                </span>`;
    };

    getNextCallback = function(chapterHTML) {   
        document.querySelector('#scriptures .chapters .next_chap').innerHTML = chapterHTML;
    };

    getPrevCallback = function(chapterHTML) {
        document.querySelector('#scriptures .chapters .prev_chap').innerHTML = chapterHTML;
    };

    // NEED TO CHANGE THIS TO WORK FOR RIGHT AND LEFT AS WELL
    getScriptureCallback = function (chapterHTML) {
        document.querySelector('#scriptures .chapters .curr_chap').innerHTML = chapterHTML;
        setupMarkers();
    };

    

    getScriptureFailed = function() {
        console.log("Warning: unable to receive scripture content from server.");
    };

    hideNextPrev = function() {
        document.querySelector('#navButtons').innerHTML = '';
        document.querySelector('#navButtons').style.height = 0;
        document.querySelector('#scriptures').style.height = '100%';
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;
        ajax("https://scriptures.byu.edu/mapscrip/model/books.php",
            (data) => {
                books = data;
                booksLoaded = true;

                if (volumesLoaded) {
                    cacheBooks(callback);
                }
            }
        );

        ajax("https://scriptures.byu.edu/mapscrip/model/volumes.php",
            (data) => {
                volumes = data;
                volumesLoaded = true;

                if (booksLoaded) {
                    cacheBooks(callback);
                }
            }
        );
    };

    navigateBook = function (bookId) {
        let book = books[bookId];
        hideNextPrev();
        if (book.numChapters === 0 ) {
            navigateChapter(bookId, 0);
        } else if (book.numChapters === 1) {
            navigateChapter(bookId, 1);
        } else {
            let content = `<div id="scripnav">
                                <div class='volume'>
                                    <h5>${book.fullName}</h5>
                                </div>
                                <div class='books'>`;

            for (let i = 0; i < book.numChapters; i++) {
                content += `<a class='btn chapter' id=${i} href='#${book.parentBookId}:${bookId}:${i + 1}'>${i + 1}</a>`;
            }

            content += '</div></div>';
            document.getElementById('scriptures').innerHTML = content;
        }

        generateBreadcrumb(book.parentBookId, bookId);
    };

    navigateChapter = function(bookId, chapter) {
        hideNextPrev();
        if (bookId !== undefined) {
            let book = books[bookId];
            let volume = volumes[book.parentBookId - 1];


            // GET NEXT AND PREV  CHAPTERS AS WELL
            // CHECK IF THEY EXIST FIRST
            // IF NOT, DON'T GET THEM

            // SLIDE

            if (!document.querySelector('.chapters')) {
                document.querySelector('#scriptures').innerHTML = `
                                                            <div class='chapters'>
                                                                <div class='prev_chap chap'></div>
                                                                <div class='curr_chap chap'></div>
                                                                <div class='next_chap chap'></div>
                                                            </div>`;
            }

            showNextPrev(bookId, chapter);

            console.log(next_chap, prev_chap);

            if (!next_chap && !prev_chap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter),
                    getScriptureCallback, getScriptureFailed, true);
            }

            if (!next_chap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter + 1),
                    getNextCallback, getScriptureFailed, true);
                next_chap = true;
            }

            if (!prev_chap) {
                ajax(encodedScriptureUrlParameters(bookId, chapter - 1),
                    getPrevCallback, getScriptureFailed, true);
                prev_chap = true;
            }
            

            

            

            
            generateBreadcrumb(book.parentBookId, bookId, chapter);
        }
    };

    navigateHome = function (volumeId) {
        let navContents = "<div id='scriptnav'>";
        hideNextPrev();
        volumes.forEach((volume) => {
            if (volumeId === undefined || volumeId === volume.id) {
                navContents += `<div class='volume'>
                                <a name='v${volume.id}' >
                                    <h5>${volume.fullName}</h5>
                                </a>
                                <div class='books'>`;
                volume.books.forEach((book) => {
                    navContents += `<a class='btn' id='${book.id}' href='#${volume.id}:${book.id}'>${book.gridName}</a>`;
                });
                navContents += `</div>`;
            }
        });
        navContents += "<br /><br /></div>";
        document.querySelector('#scriptures').innerHTML = navContents;

        volumeId !== undefined ? generateBreadcrumb(volumeId) : generateBreadcrumb();
    };

    nextChapter = function(bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [
                    book.parentBookId,
                    bookId,
                    chapter + 1,
                    titleForBookChapter(book, chapter + 1)
                ];
            }

            let nextBook = books[bookId + 1];

            if (nextBook !== undefined) {
                let nextChapterValue = 0;
                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }

                return [
                    nextBook.parentBookId,
                    nextBook.id,
                    nextChapterValue,
                    titleForBookChapter(nextBook, nextChapterValue)
                ];
            } else if (nextBook === undefined) {
                let newVolume = volumes[book.parentBookId];
                if (newVolume !== undefined) {
                    nextBook = newVolume.books[0];
                    let nextChapterValue = 0;
                    if (nextBook.numChapters > 0) {
                        nextChapterValue = 1;
                    }

                    return [
                        newVolume.id,
                        nextBook.id,
                        nextChapterValue,
                        titleForBookChapter(nextBook, nextChapterValue)
                    ];
                }
            }
        }
    };

    onHashChanged = function () {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } else if (ids.length === 1) {
            let volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
                navigateHome();
            } else {
                navigateHome(volumeId);
            }
        } else if (ids.length >= 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(bookId);
                } else {
                    let chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(bookId, chapter)
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    };

    previousChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter > 1) {
                return [
                    book.parentBookId,
                    bookId,
                    chapter - 1,
                    titleForBookChapter(book, chapter - 1)
                ];
            } else {
                let prevBook = books[bookId - 1];

                if (prevBook !== undefined) {
                    return [
                        prevBook.parentBookId,
                        prevBook.id,
                        prevBook.numChapters,
                        titleForBookChapter(prevBook, prevBook.numChapters)
                    ]
                } else if (prevBook === undefined) {
                    let prevVolume = volumes[book.parentBookId - 2];
                    if (prevVolume !== undefined) {
                        prevBook = prevVolume.books[prevVolume.books.length - 1];
                        let prevChapterValue = prevBook.numChapters;

                        return [
                            prevVolume.id,
                            prevBook.id,
                            prevChapterValue,
                            titleForBookChapter(prevBook, prevChapterValue)
                        ];
                    }
                }
            }
        }
    };

    setupBounds = function () {
        if (gmMarkers.length === 0) {
            map.setZoom(8);
            map.panTo({lat: 31.777444, lng: 35.234935});
        }

        if(gmMarkers.length === 1) {
            map.setZoom(8);
            map.panTo(gmMarkers[0].position);
        }

        if (gmMarkers.length > 1) {
            let bounds = new google.maps.LatLngBounds();
            gmMarkers.forEach((marker) => {
                bounds.extend(marker.getPosition());
            });

            map.fitBounds(bounds);

            // The code above was adapted by code from: https://stackoverflow.com/questions/19304574/center-set-zoom-of-map-to-cover-all-visible-markers
            // Submitted by user: https://stackoverflow.com/users/954940/adam
        }
    };

    setupMarkers = function () {
        if (window.google === undefined) {
            // retry fater delay
            let retryId = window.setTimeout(setupMarkers, retryDelay);

            retryDelay += retryDelay;
            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }

            return;
        }

        if (gmMarkers.length > 0) {
            clearMarkers();
        }

        document.querySelectorAll('a[onclick^="showLocation("]').forEach((el) => {
            let matches = LAT_LON_PARSER.exec(el.getAttribute("onclick"));

            if (matches) {
                let placename = matches[INDEX_PLACENAME];
                let latitude = parseFloat(matches[INDEX_LATITUDE]);
                let longitude = parseFloat(matches[INDEX_LONGITUDE]);
                let flag = matches [INDEX_PLACE_FLAG];

                if  (flag !== "") {
                    placename += " " + flag;
                }

                addMarker(placename, latitude, longitude);
            }
        });

        setupBounds();
    };

    showLocation = function (geotagId, placename, latitude, longitude, viewLatitude, viewLongitude, viewTilt, viewRoll, viewAltitude, viewHeading) {
        gmMarkers.forEach((marker) => {
            let myLatLng = new google.maps.LatLng(latitude, longitude);

            if (marker.position.lat() === myLatLng.lat() && marker.position.lng() === myLatLng.lng()) {
                let zoom = Math.round(Number(viewAltitude) / 450);
                6 > zoom ? zoom = 6 : 18 < zoom && (zoom = 18); // https://scriptures.byu.edu/mapscrip/
                map.setZoom(zoom);
                map.panTo(marker.position);
            }
        });
    };

    showNextPrev = function(bookId, chapter) {
        document.querySelector('#navButtons')
            .innerHTML = `
                            <div id='prev'>
                                <i class="material-icons">
                                navigate_before
                                </i>
                                <span>Prev</span>
                            </div>
                            <div id='next'>
                                <span>Next</span>
                                <i class="material-icons">
                                navigate_next
                                </i>
                            </div>
                        `;
        document.querySelector('#navButtons').style.height = '46px';
        document.querySelector('#navButtons').style.borderBottom = '1px solid #eee';
        document.querySelector('#scriptures').style.height = 'calc(100% - 46px)';

        // NEED TO ADJUST THIS TO CHANGE THE HASH BUT ALSO JUST SLIDE IN THE NEXT CHAPTER
        document.querySelector('#next').addEventListener('click', () => {
            let next = nextChapter(bookId, chapter);
            console.log(next);
            if (next !== undefined) {
                let prev_el = document.querySelector('.prev_chap');
                let curr_el = document.querySelector('.curr_chap');
                let next_el = document.querySelector('.next_chap');

                    prev_el.addEventListener('transitionend', function handler() {
                        prev_el.classList.replace('prev_chap', 'next_chap');
                        prev_el.classList.remove('slide');
                        transitionComplete(next[1], next[2] + 1, getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                    next_el.addEventListener('transitionend', function handler() {
                        
                        next_el.classList.replace('next_chap', 'curr_chap');
                        next_el.classList.remove('slide');
                        transitionComplete(next[1], next[2] + 1, getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                    curr_el.addEventListener('transitionend', function handler() {
                        curr_el.classList.replace('curr_chap', 'prev_chap');
                        curr_el.classList.remove('slide');
                        transitionComplete(next[1], next[2] + 1, getNextCallback);
                        this.removeEventListener('transitionend', handler);
                    });

                document.querySelectorAll('.chap').forEach(chap => {
                    chap.classList.add('slide');
                    // console.log(chap.classList); 
                });

                // next_chap = false;

                location.hash = `#${next[0]}:${next[1]}:${next[2]}`;
            } else {
                navigateHome();
            }
        });

        // NEED TO ADJUST THIS TO CHANGE THE HASH BUT ALSO JUST SLIDE IN THE PREV CHAPTER
        document.querySelector('#prev').addEventListener('click', () => {
            let prev = previousChapter(bookId, chapter);
            if (prev !== undefined) {
                let prev_el = document.querySelector('.prev_chap');
                let curr_el = document.querySelector('.curr_chap');
                let next_el = document.querySelector('.next_chap');

                prev_el.addEventListener('transitionend', function handler() {
                    prev_el.classList.replace('prev_chap', 'curr_chap');
                    prev_el.classList.remove('slide_prev');
                    console.log('here');
                    transitionComplete(prev[1], prev[2] - 1, getPrevCallback);
                    this.removeEventListener('transitionend', handler);
                });

                next_el.addEventListener('transitionend', function handler() {
                    
                    next_el.classList.replace('next_chap', 'prev_chap');
                    next_el.classList.remove('slide_prev');
                    transitionComplete(prev[1], prev[2] - 1, getPrevCallback);
                    this.removeEventListener('transitionend', handler);
                });

                curr_el.addEventListener('transitionend', function handler() {
                    curr_el.classList.replace('curr_chap', 'next_chap');
                    curr_el.classList.remove('slide_prev');
                    transitionComplete(prev[1], prev[2] - 1, getPrevCallback);
                    this.removeEventListener('transitionend', handler);
                });

                document.querySelectorAll('.chap').forEach(chap => {
                    chap.classList.add('slide_prev');
                    // console.log(chap.classList); 
                });
                location.hash = `#${prev[0]}:${prev[1]}:${prev[2]}`;
            } else {
                navigateHome();
            }
        });
    };

    // slideLeft = function () {
    //     let prev_el = document.querySelector('.prev_chap');
    //     let curr_el = document.querySelector('.curr_chap');
    //     let next_el = document.querySelector('.next_chap');

    //     document.querySelectorAll('.chap').forEach(chap => {
    //         // chap.style.transform = 'translateX(-350px)';
    //         chap.classList.add('slide');
    //         console.log(chap.classList);
    //     });

    //     next_el.ontransitionend = () => {
    //         console.log('next is done');
    //     }

    //     prev_el.classList.replace('prev_chap', 'next_chap');
    //     curr_el.classList.replace('curr_chap', 'prev_chap');
    //     next_el.classList.replace('next_chap', 'curr_chap');

    //     console.log(prev_el);
    // }

    titleForBookChapter = function (book, chapter) {
        if (chapter > 0){
            return `${book.tocName} ${chapter}`;
        }

        return book.tocName;
    };

    transitionComplete = function(book, chapter, ajaxCallback) {
        transitions++;

        if (transitions === TRANSITION_LIMIT) {
            ajax(encodedScriptureUrlParameters(book, chapter),
                        ajaxCallback, getScriptureFailed, true);
            transitions = 0;
        }
    }

    /*---------------------------------------------------------------
    *                       PUBLIC API
    */

    return {
        init,
        changeHash,
        onHashChanged,
        showLocation
    }

}());
