// Saves options to chrome.storage.sync.
function save_options() {

  var basicPatterns = document.getElementById('basicPatterns').value;
  var fullPatterns = document.getElementById('fullPatterns').value;
  var timeoutPatterns = document.getElementById('timeoutPatterns').value;
  var frequency = document.getElementById('frequency').value;
  var debugMode = document.getElementById('debugMode').checked;

  console.log("save_options", {
    basicPatterns: basicPatterns,
    fullPatterns: fullPatterns,
    timeoutPatterns: timeoutPatterns,
    frequency: frequency,
    debugMode: '' + debugMode
  });

  chrome.storage.sync.set({
    basicPatterns: basicPatterns,
    fullPatterns: fullPatterns,
    timeoutPatterns: timeoutPatterns,
    frequency: frequency,
    debugMode: debugMode
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
function restore_options() {
  chrome.storage.sync.get({
    basicPatterns: 'dailymail\\.co\nexpress\\.co',
    fullPatterns: '',
    timeoutPatterns: '',
    frequency: '5',
    debugMode: 'false'
  }, function(items) {
    console.log("restore_options", items);
    document.getElementById('basicPatterns').value = items.basicPatterns;
    document.getElementById('fullPatterns').value = items.fullPatterns;
    document.getElementById('timeoutPatterns').value = items.timeoutPatterns;
    document.getElementById('frequency').value = items.frequency;
    document.getElementById('debugMode').checked = items.debugMode;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
