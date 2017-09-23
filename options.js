// Saves options to chrome.storage.sync.
function save_options() {

  var basicPatterns = document.getElementById('basicPatterns').value;
  var fullPatterns = document.getElementById('fullPatterns').value;
  var timeoutPatterns = document.getElementById('timeoutPatterns').value;
  var frequency = document.getElementById('frequency').value;
  var debugMode = document.getElementById('debugMode').checked;
  var lockTime = document.getElementById('lockTime').value;
  var enableSettingsLock = document.getElementById('enableSettingsLock').checked;

  console.log("save_options", {
    basicPatterns: basicPatterns,
    fullPatterns: fullPatterns,
    timeoutPatterns: timeoutPatterns,
    frequency: frequency,
    debugMode: '' + debugMode,
    enableSettingsLock: enableSettingsLock,
    lockTime: lockTime
  });

  chrome.storage.sync.set({
    basicPatterns: basicPatterns,
    fullPatterns: fullPatterns,
    timeoutPatterns: timeoutPatterns,
    frequency: frequency,
    debugMode: debugMode,
    enableSettingsLock: enableSettingsLock,
    lockTime: lockTime
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = ' ';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options(cb) {
  chrome.storage.sync.get({
    basicPatterns: 'dailymail\\.co\nexpress\\.co',
    fullPatterns: '',
    timeoutPatterns: '',
    frequency: '5',
    debugMode: false,
    enableSettingsLock: false,
    lockTime: '17:00'
  }, function(items) {
    console.log("restore_options", items);
    document.getElementById('basicPatterns').value = items.basicPatterns;
    document.getElementById('fullPatterns').value = items.fullPatterns;
    document.getElementById('timeoutPatterns').value = items.timeoutPatterns;
    document.getElementById('frequency').value = items.frequency;
    document.getElementById('debugMode').checked = items.debugMode;
    document.getElementById('lockTime').value = items.lockTime;
    document.getElementById('enableSettingsLock').checked = items.enableSettingsLock;
    cb(items);
  });
}

function init() {
  restore_options(function (items) {
    if (items.enableSettingsLock) {
      var timeParts = items.lockTime.split(":");
      var now = new Date();

      var nowMins = (now.getHours()*60 + now.getMinutes());
      var unblockMins = ((+timeParts[0])*60 + (+timeParts[1]));

      if (nowMins >= unblockMins) {
        // woo, do nothing, we don't need to block the page
      } else {
        document.body.innerHTML = '';
        document.body.backgroundColor = "grey";
        var child = document.createElement("h1");
        child.innerText = "Blocked until " + items.lockTime;
        document.body.appendChild(child);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
document.getElementById('save').addEventListener('click', save_options);
