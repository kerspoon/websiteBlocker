(function () {

  // redirect <days :str> <fromTime :str> <toTime :str> <fromUrl :regex> <toUrl :regex?>
  // e.g ["mon,tue,wed", "13:40", "23:00", /facebook\.com"/

  // days ::= "elem,elem ..." (comma seperated array of elements)
  //   elem ::= all, weekday, weekend, worknight, monday, ..., sunday
  // 'to-url' defaults to "about:blank" if missing

  var checkFrequency = 5*60; // every 5 mins

  var patterns = [
    ["weekday", "09:00", "12:59", /facebook\.com/],
    ["all", "00:00", "24:00", /facebook\.com\/?$/, "https://facebook.com/messages/"],

  ];

  var basicPatterns = [
    /dailymail\.co/,
    /express\.co/
  ];

  // ========================================================================== //
  // ========================================================================== //

  console.log('window.location.href', window.location.href);

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

  function checkAndRedirect() {
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

  function checkRegularly(frequency) {
    checkAndRedirect();
    setTimeout(checkRegularly, frequency*1000);
  }

  checkRegularly(checkFrequency);

}());
