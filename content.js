(function () {

  // redirect <days :str> <fromTime :str> <toTime :str> <fromUrl :regex> <toUrl :regex?>
  // e.g ["mon,tue,wed", "13:40", "23:00", /facebook\.com"/

  // days ::= "elem,elem ..." (comma seperated array of elements)
  //   elem ::= all, weekday, weekend, worknight, monday, ..., sunday
  // 'to-url' defaults to "about:blank" if missing

  var defaultCheckFrequency = 5; // every 5 mins

  var checkFrequency, basicPatterns, fullPatterns, timeoutPatterns;
  var debugMode = true;

  // ========================================================================== //
  // Logging
  // ========================================================================== //

  function log(msg) {
    if(debugMode) {
      console.log("PLUGIN-URL-REDIRECT " + ([].slice.call(arguments)).join(" "));
    }
  }

  // ========================================================================== //
  // Redirect (by calling `bg.js`)
  // ========================================================================== //

  function redirect(to) {
    to = to ? to : 'about:blank';
    chrome.extension.sendRequest({
      redirect: to
    }); // send message to redirect
  }

  // ========================================================================== //
  // Util
  // ========================================================================== //

  function callWhenPageReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      setTimeout(callback, 0);
    }
  }

  // ========================================================================== //
  // Date & Time
  // ========================================================================== //

  function getDayName(day) {
    var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[ day ? day : (new Date()).getDay() ];
  };

  function dayMatches(matchString, day) {

    if (matchString === 'all' || matchString === '') {
      return true;
    }

    var today = getDayName(day);
    var matchParts = matchString.split(',');

    for (var i = 0; i < matchParts.length; i++) {
      var matchPart = matchParts[i].trim();

      if (matchPart === today) {
        return true;
      }

      if (matchPart === 'weekend') {
        return (today === 'saturday' || today === 'sunday');
      }

      if (matchPart === 'weekday') {
        return (today !== 'saturday' && today !== 'sunday');
      }

      if (matchPart === 'worknight') {
        return (today !== 'friday' && today !== 'saturday');
      }
    }

    return false;
  }

  function checkTime (h,m,a,b,c,d){
    // http://stackoverflow.com/questions/9081220
    if (a > c || ((a == c) && (b > d))) {
        log('not a valid input', a, b, c, d);
    } else {
         if (h > a && h < c) {
            return true;
         } else if (h == a && m >= b) {
            return true;
         } else if (h == c && m <= d) {
            return true;
         } else {
            return false;
         }
    }
  }

  function timeInRange(min, max, time) {
    // e.g. timeInRange("00:00", "24:00", new Date()) --> true

    // default the time var to now
    time = time ? time : new Date();

    return checkTime(
      time.getHours(),
      time.getMinutes(),
      min.split(':')[0],
      min.split(':')[1],
      max.split(':')[0],
      max.split(':')[1]);
  }

  // ========================================================================== //
  // Save & Load
  // ========================================================================== //

  function parseSettings(items) {

    var basicPatterns = [];
    var basicLines = items.basicPatterns.split("\n");
    for (var i = 0; i < basicLines.length; i++) {
      var line = basicLines[i].trim();
      if (line) {
        basicPatterns.push(new RegExp(line));
      }
    }

    var fullPatterns = [];
    var fullLines = items.fullPatterns.split("\n");
    for (var i = 0; i < fullLines.length; i++) {
      // worknight 23:20 24:00 reddit\\.com
      var trimmedLine = fullLines[i].trim();
      if(!trimmedLine) { continue; } // skip empty lines
      var lineParts = trimmedLine.split(" ");
      if (lineParts.length >= 4) {
        lineParts[3] = new RegExp(lineParts[3]);
        fullPatterns.push(lineParts);
      } else {
        log("expected 4 or 5 arguments in fullLine got", lineParts.length);
      }
    }

    var timeoutPatterns = [];
    var timeoutLines = items.timeoutPatterns.split("\n");
    for (var i = 0; i < timeoutLines.length; i++) {
      var trimmedLine = timeoutLines[i].trim();
      if(!trimmedLine) { continue; } // skip empty lines
      var lineParts = trimmedLine.split(" ");
      if (lineParts.length >= 3) {
        // reddit.com 20 40 1474065141460
        timeoutPatterns.push([
          new RegExp(lineParts[0]),
          parseFloat(lineParts[1]),
          parseFloat(lineParts[2]),
          parseInt(lineParts[3], 0)
        ]);
      } else {
        log("expected 3 or 4 arguments in timeoutLine got", lineParts.length);
      }
    }

    return {
      basicPatterns: basicPatterns,
      fullPatterns: fullPatterns,
      timeoutPatterns: timeoutPatterns,
      checkFrequency: parseFloat(items.checkFrequency),
      debugMode: items.debugMode
    };
  }

  function unparseSettings(basicPatterns, fullPatterns, timeoutPatterns, checkFrequency) {
    // turn all these into strings first (unparse!)
    return {
      basicPatterns: basicPatterns.map(function(obj) {
        return obj.toString().slice(1,-1)
      }).join("\n"),
      fullPatterns: fullPatterns.map(function(obj) {
        obj[3] = obj[3].toString().slice(1,-1);
        return obj.join(" ");
      }).join("\n"),
      timeoutPatterns: timeoutPatterns.map(function(obj) {
        obj[0] = obj[0].toString().slice(1,-1);
        return obj.join(" ");
      }).join("\n"),
      frequency: "" + checkFrequency
    }
  }

  function saveOptions(callback) {
    var optionsStr = unparseSettings(basicPatterns, fullPatterns, timeoutPatterns, checkFrequency);
    log("saveOptions", JSON.stringify(optionsStr));
    chrome.storage.sync.set(optionsStr, callback);
  }

  function loadOptions(callback) {
    chrome.storage.sync.get({
      basicPatterns: '',
      fullPatterns: '',
      timeoutPatterns: '',
      checkFrequency: defaultCheckFrequency,
      debugMode: false
    }, function(items) {
      log("loadOptions", JSON.stringify(items));
      var settings = parseSettings(items);

      checkFrequency = settings.checkFrequency;
      basicPatterns = settings.basicPatterns;
      timeoutPatterns = settings.timeoutPatterns;
      fullPatterns = settings.fullPatterns;
      debugMode = settings.debugMode;

      callback();
    });
  }

  // ========================================================================== //
  // Timeout blocker
  // ========================================================================== //

  function getTimeoutPatternData() {
    for (var i = 0; i < timeoutPatterns.length; i++) {
      var urlRegex = timeoutPatterns[i][0];
      var href = window.location.href;
      if (urlRegex.test(href)) {
        var accessDuration = timeoutPatterns[i][1];
        var blockDuration = timeoutPatterns[i][2];
        var unblockEnd = new Date(timeoutPatterns[i][3]);
        var state, lockedUntil;

        if (!timeoutPatterns[i][3]) {
          // we have never pressed the unblock button hence we show the button.
          state = 'locked';
          lockedUntil = false;
        } else {
          var now = new Date();
          lockedUntil = new Date(unblockEnd.getTime() + blockDuration*1000*60);

          if (now < unblockEnd) {
           // we have previously clicked the "unblock" button and the time set by
           // that has not yet elapsed. Hence we should allow the user to view
           // the page as normal.
           state = 'unlocked'
         } else if (now > lockedUntil) {
             // the "cooldown" time has expired, we are no longer sealed. Or we
             // have never clicked the "unblock" button. Either way that is what we
             // need to show.
             state = 'locked';
          } else {
            // we have set a lock that is still active, don't show the lock button
            // dont allow it to be pressed. Just clear the page and let the user
            // know when it will unlock.
            state = 'sealed';
          }
        }

        log("timeoutPattern match", urlRegex, state, accessDuration, blockDuration, unblockEnd, lockedUntil);

        return {
          accessDuration: accessDuration,
          blockDuration: blockDuration,
          unblockEnd: unblockEnd,
          lockedUntil: lockedUntil,
          state: state,
          id: i
        };
      }
    }
    return false;
  }

  function unblockPage() {

    log('unblock button pressed');

    // we need to double check the timeouts as they might have been set by
    // another tab that is on the same page
    loadOptions(function () {
      data = getTimeoutPatternData();

      if (data.state == 'locked') {
        log('unblock button pressed, unblock permitted');
        // update the setting to set the unblock/block time
        timeoutPatterns[data.id][3] = (new Date()).getTime() + 1000*60*data.accessDuration;

        // save the new kill time so that it gets remembered if we close the page
        // then kill the page blocker, by reloading the page
        saveOptions(function () { location.reload();});
      } else {
        // someone must have done something on another page.
        // reload the page to show the correct data.
        log('unblock button pressed, not unblocking, wrong state', data.state);
        location.reload();
      }
    });
  }

  function createPageOverlay(data) {

    log('create overlay');

    var div = document.getElementById('PLUGIN-URL-REDIRECT');

    if (!div) {

      div = document.createElement("div");
      div.id = "PLUGIN-URL-REDIRECT";
      div.style.zIndex = 10000;
      div.style.position = 'fixed';
      div.style.backgroundColor = "grey";
      div.style.height = "100%";
      div.style.width = "100%";
      div.style.top = 0;
      div.style.left = 0;
      div.style["text-align"] = "center";

      if (data.state == "sealed") {
        // we are in the "cooldown" peroid, don't show the unblock button
        var child = document.createElement("h1");
        child.innerText = "Blocked until " + data.lockedUntil;
        div.appendChild(child);
      } else {
        var child = document.createElement("button");
        child.style.width = "100px";
        child.style.height = "50px";
        child.style.position = 'absolute';
        div.style.backgroundColor = "lightred";
        child.style.top = "50%"
        child.innerText = "Unblock";
        child.onclick = unblockPage;
        div.appendChild(child);
      }

      var msg = document.createElement("h2");
      msg.innerText = "Blocked settings. Access: " + data.accessDuration + ". Cooldown: " + data.blockDuration;
      div.appendChild(msg);

      // replace entire page with the new div, clear all stylesheets
      var elements = document.querySelectorAll('style, link[rel=stylesheet]');
      for(var i=0;i<elements.length;i++){
        elements[i].parentNode.removeChild(elements[i]);
      }
      document.body.innerHTML = '';
      document.body.appendChild(div);
    }
    return div;
  }


  // ========================================================================== //
  // Test if the current page needs blocking
  // ========================================================================== //

  function checkAndRedirect() {

    log("checkAndRedirect");

    for (var i = 0; i < basicPatterns.length; i++) {
      if (basicPatterns[i].test(window.location.href)) {
        log("redirect basicPattern", basicPatterns[i], "about:blank");
        redirect();
        break;
      }
    }

    for (var i = 0; i < fullPatterns.length; i++) {
      var day = fullPatterns[i][0];
      var fromTime = fullPatterns[i][1];
      var toTime = fullPatterns[i][2];
      var urlRegex = fullPatterns[i][3];
      var redirectLocation = fullPatterns[i][4];
      var href = window.location.href;

      if (dayMatches(day) && timeInRange(fromTime, toTime) && urlRegex.test(href)) {
        log("redirect fullPattern", urlRegex, redirectLocation || "about:blank");
        redirect(redirectLocation);
        break;
      }
    }

    data = getTimeoutPatternData();
    if (!data || data.state == "unlocked") {
      // we either have a page that is not in the block list or
      // we have unlocked the page, either way show as normal
      return;
    } else {
      // show either the locked page or the unlock button.
      callWhenPageReady(function() {
        createPageOverlay(data);
      });
    }
  }

  function checkRegularly() {
    checkAndRedirect();
    setTimeout(checkRegularly, checkFrequency*60*1000);
  }

  // ========================================================================== //
  // Init
  // ========================================================================== //

  // first load all the settings
  // then regularly check to see if this page should be blocked.
  loadOptions(checkRegularly);

}());
