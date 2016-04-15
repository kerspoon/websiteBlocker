// Saves options to chrome.storage.sync.
function save_options() {
  console.log('save_options');

  var basicPatterns = document.getElementById('basicPatterns').value;
  var fullPatterns = document.getElementById('fullPatterns').value;
  var frequency = document.getElementById('frequency').value;

  chrome.storage.sync.set({
    basicPatterns: basicPatterns,
    fullPatterns: fullPatterns,
    frequency: frequency
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
  console.log('restore_options');
  chrome.storage.sync.get({
    basicPatterns: 'dailymail\\.co\nexpress\\.co',
    fullPatterns: '',
    frequency: '5'
  }, function(items) {
    document.getElementById('basicPatterns').value = items.basicPatterns;
    document.getElementById('fullPatterns').value = items.fullPatterns;
    document.getElementById('frequency').value = items.frequency;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
