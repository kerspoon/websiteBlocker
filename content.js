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
    if (document.readyState === "complete") {
      setTimeout(callback, 0);
    } else {
      document.addEventListener("DOMContentLoaded", callback);
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
        console.log('not a valid input', a, b, c, d);
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
      debugMode: !!debugMode
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

  function unblockPage() {

    var openAccess = inOpenAccessPeriod();
    var cooldown = inCooldownPeriod();

    log('unblock button pressed', openAccess, cooldown);

    if (openAccess) {
      // dont let people unblock here, they shouldn't be able to anyway.
      // regardless it just adds more time when it should be blocking
      log('not unblocking as in openAccess');
      // reload the page to show the correct data.
      location.reload();
      return;
    }

    if (cooldown) {
      // we should still be blocked. don't let them unblock
      // it must have been unblocked from another page, while this was open
      log('not unblocking as in cooldown');
      // reload the page to show the correct data.
      location.reload();
      return;
    }

    // update the setting to set the unblock/block time
    for (var i = 0; i < timeoutPatterns.length; i++) {
      if (timeoutPatterns[i][0].test(window.location.href)) {
        timeoutPatterns[i][3] = (new Date()).getTime() + 1000*60*timeoutPatterns[i][1];
      }
    }

    // kill the page blocker, by realoding the page
    location.reload();

    // save the new kill time so that it gets remembered if we close the page
    saveOptions();
  }

  function inCooldownPeriod(blockTime) {
    var lockedUntil = new Date(unblockEnd.getTime() + blockTime*1000*60);
    var now = new Date();
    log('in cooldown period?', now < lockedUntil, "(", now.getTime(), lockedUntil.getTime(), ")");
    return now < lockedUntil;
  }

  function createPageOverlay(accessTime, blockTime, unblockEnd) {

    log('create overlay');

    var div = document.getElementById('PLUGIN-URL-REDIRECT');

    if (!div) {

      log('make the div');

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

      if (inCooldownPeriod()) {
        var child = document.createElement("h1");
        child.innerText = "Blocked until " + lockedUntil;
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
      msg.innerText = "Blocked settings. Access: " + accessTime + ". Cooldown: " + blockTime;
      div.appendChild(msg);

      // replace entire page with the div
      var elements = document.querySelectorAll('style, link[rel=stylesheet]');
      for(var i=0;i<elements.length;i++){
        elements[i].parentNode.removeChild(elements[i]);
      }
      document.body.innerHTML = '';
      document.body.appendChild(div);
    }
    return div;
  }

  function inOpenAccessPeriod(unblockEnd) {
    var now = new Date();
    log('in open-access period?', unblockEnd && now < unblockEnd, "(", now.getTime(), unblockEnd.getTime(), ")");
    return unblockEnd && now < unblockEnd;
  }

  function activateTimeoutBlocker(accessTime, blockTime, unblockEnd) {

    log("activateTimeoutBlocker", accessTime, blockTime, unblockEnd);

    if (inOpenAccessPeriod(unblockEnd)) {
      // we have previously clicked the unblock button
      // and the timer set by that button has not expired
      // hence we should just let them view the page
      return;
    } else {
      // show a full page overlay with a button to unblock
      // but we have to wait for the page to load first
      callWhenPageReady(function() {
        createPageOverlay(accessTime, blockTime, unblockEnd);
      });
    }
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

    for (var i = 0; i < timeoutPatterns.length; i++) {
      var urlRegex = timeoutPatterns[i][0];
      var href = window.location.href;

      if (urlRegex.test(href)) {

        var accessTime = timeoutPatterns[i][1];
        var blockTime = timeoutPatterns[i][2];
        var unblockEnd = new Date(timeoutPatterns[i][3]);

        activateTimeoutBlocker(accessTime, blockTime, unblockEnd);
        break;
      }
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
