(function () {

  // redirect <days :str> <fromTime :str> <toTime :str> <fromUrl :regex> <toUrl :regex?>
  // e.g ["mon,tue,wed", "13:40", "23:00", /facebook\.com"/

  // days ::= "elem,elem ..." (comma seperated array of elements)
  //   elem ::= all, weekday, weekend, worknight, monday, ..., sunday
  // 'to-url' defaults to "about:blank" if missing

  var defaultCheckFrequency = 5; // every 5 mins


  // ========================================================================== //
  // ========================================================================== //

  function redirect(to) {
    to = to ? to : 'about:blank';
    console.log('redirect', window.location.href, to);
    chrome.extension.sendRequest({
      redirect: to
    }); // send message to redirect
  }

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
  // ========================================================================== //

  function checkAndRedirect(basicPatterns, patterns) {

    for (var i = 0; i < basicPatterns.length; i++) {
      if (basicPatterns[i].test(window.location.href)) {
        redirect();
        break;
      }
    }

    for (var i = 0; i < patterns.length; i++) {
      var day = patterns[i][0];
      var fromTime = patterns[i][1];
      var toTime = patterns[i][2];
      var urlRegex = patterns[i][3];
      var redirectLocation = patterns[i][4];
      var href = window.location.href;

      if (dayMatches(day) && timeInRange(fromTime, toTime) && urlRegex.test(href)) {
        redirect(redirectLocation);
        break;
      }
    }
  }

  var checkFrequency, basicPatterns, fullPatterns;

  function checkRegularly() {
    checkAndRedirect(basicPatterns, fullPatterns);
    setTimeout(checkRegularly, checkFrequency*60*1000);
  }

  // ========================================================================== //
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
      var lineParts = fullLines[i].trim().split(" ");
      if (lineParts.length > 3) {
        lineParts[3] = new RegExp(lineParts[3]);
        fullPatterns.push(lineParts);
      }
    }

    return {
      basicPatterns: basicPatterns,
      fullPatterns: fullPatterns,
      checkFrequency: parseFloat(items.checkFrequency)
    };
  }

  chrome.storage.sync.get({
    basicPatterns: '',
    fullPatterns: '',
    checkFrequency: defaultCheckFrequency
  }, function(items) {
    /*
    console.log('basic', items.basicPatterns);
    console.log('full', items.fullPatterns);
    console.log('checkFrequency', items.checkFrequency);
    console.log('window.location.href', window.location.href);
    */

    var settings = parseSettings(items);

    checkFrequency = settings.checkFrequency;
    basicPatterns = settings.basicPatterns;
    fullPatterns = settings.fullPatterns;

    checkRegularly();
  });

}());
