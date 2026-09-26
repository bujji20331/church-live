/**
 * CHURCH LIVE — MEDIA DEVICES MODULE
 *
 * Universal hardware-agnostic media device detection and management.
 * This module provides a clean abstraction over the browser's MediaDevices API
 * so Church Live can work with ANY video/audio device the OS/browser exposes.
 *
 * Architecture:
 * Physical equipment (camera, mixer, etc.)
 *     ↓ Connection / adapter / capture device
 *     ↓ Mac or Windows (operating system)
 *     ↓ Browser MediaDevices API (navigator.mediaDevices)
 *     ↓ Church Live (this module)
 *
 * Church Live does NOT need to know the physical manufacturer.
 * It only cares about the videoinput/audioinput devices the browser presents.
 */

// ============================================================================
// PRIVATE STATE
// ============================================================================

let _cachedVideoDevices = [];
let _cachedAudioDevices = [];
let _permissionRequested = false;
let _permissionGranted = false;

/**
 * Normalize a MediaDeviceInfo into a consistent device object.
 * @param {MediaDeviceInfo} device - Raw device from enumerateDevices()
 * @returns {Object} Normalized device object
 */
function _normalizeDevice(device) {
  return {
    deviceId: device.deviceId,
    label: device.label || '',
    kind: device.kind,
    groupId: device.groupId,
    // Helper flags
    isVideo: device.kind === 'videoinput',
    isAudio: device.kind === 'audioinput',
    // Display name fallback
    displayName: device.label || (device.kind === 'videoinput' ? 'Video Device' : 'Audio Device')
  };
}

/**
 * Sort devices: labeled devices first, then by label alphabetically.
 * @param {Array} devices - Array of normalized device objects
 * @returns {Array} Sorted array
 */
function _sortDevices(devices) {
  return [...devices].sort((a, b) => {
    // Devices with labels come first
    const aHasLabel = a.label && a.label.trim().length > 0;
    const bHasLabel = b.label && b.label.trim().length > 0;
    if (aHasLabel !== bHasLabel) return aHasLabel ? -1 : 1;
    // Then sort alphabetically by label
    return a.label.localeCompare(b.label);
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Request media permissions (camera and/or microphone) from the user.
 * This is required before device labels become available in most browsers.
 *
 * @param {Object} options - Permission options
 * @param {boolean} options.video - Request camera permission (default: true)
 * @param {boolean} options.audio - Request microphone permission (default: true)
 * @returns {Promise<Object>} { success: boolean, error?: Error, stream?: MediaStream }
 */
async function requestMediaPermissions(options = {}) {
  const { video = true, audio = true } = options;

  // Check if MediaDevices API is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      success: false,
      error: new Error('MediaDevices API not supported in this browser')
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    _permissionRequested = true;
    _permissionGranted = true;
    console.log('[Church Live] Media permissions granted');
    return { success: true, stream };
  } catch (error) {
    _permissionRequested = true;
    _permissionGranted = false;
    console.warn('[Church Live] Media permissions denied:', error.name, error.message);
    return { success: false, error };
  }
}

/**
 * Enumerate all media devices (video and audio).
 * If permissions haven't been granted, labels may be empty.
 * Call requestMediaPermissions() first for better labels.
 *
 * @returns {Promise<Array>} Array of normalized device objects
 */
async function enumerateMediaDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.warn('[Church Live] enumerateDevices not supported');
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const normalized = devices.map(_normalizeDevice);

    // Cache for quick access
    _cachedVideoDevices = normalized.filter(d => d.isVideo);
    _cachedAudioDevices = normalized.filter(d => d.isAudio);

    return normalized;
  } catch (error) {
    console.error('[Church Live] Failed to enumerate devices:', error);
    return [];
  }
}

/**
 * Enumerate video input devices (cameras, capture devices, virtual cameras).
 *
 * @returns {Promise<Array>} Array of video device objects
 */
async function enumerateVideoDevices() {
  const allDevices = await enumerateMediaDevices();
  return _sortDevices(allDevices.filter(d => d.isVideo));
}

/**
 * Enumerate audio input devices (microphones, mixers, audio interfaces).
 *
 * @returns {Promise<Array>} Array of audio device objects
 */
async function enumerateAudioDevices() {
  const allDevices = await enumerateMediaDevices();
  return _sortDevices(allDevices.filter(d => d.isAudio));
}

/**
 * Get a device by its deviceId.
 *
 * @param {string} deviceId - The deviceId to look up
 * @returns {Promise<Object|null>} Device object or null if not found
 */
async function getDeviceById(deviceId) {
  if (!deviceId) return null;

  // Check cache first
  const cached = [..._cachedVideoDevices, ..._cachedAudioDevices].find(d => d.deviceId === deviceId);
  if (cached) return cached;

  // Fallback to fresh enumeration
  const devices = await enumerateMediaDevices();
  return devices.find(d => d.deviceId === deviceId) || null;
}

/**
 * Get the label for a deviceId, requesting permissions if needed.
 *
 * @param {string} deviceId - The deviceId
 * @returns {Promise<string>} Device label or generic fallback
 */
async function getDeviceLabel(deviceId) {
  const device = await getDeviceById(deviceId);
  if (!device) return 'Unknown Device';

  // If label is empty and we haven't requested permissions yet, try to get them
  if (!device.label && !_permissionRequested) {
    await requestMediaPermissions({ video: true, audio: true });
    const refreshed = await getDeviceById(deviceId);
    return refreshed?.label || device.displayName;
  }

  return device.label || device.displayName;
}

/**
 * Get the default/preferred video device.
 * Strategy: First labeled device, or first available device.
 *
 * @returns {Promise<Object|null>} Default video device or null
 */
async function getDefaultVideoDevice() {
  const devices = await enumerateVideoDevices();
  if (devices.length === 0) return null;

  // Prefer a device with a meaningful label
  const labeled = devices.find(d => d.label && d.label.trim().length > 0);
  return labeled || devices[0];
}

/**
 * Get the default/preferred audio device.
 * Strategy: First labeled device, or first available device.
 *
 * @returns {Promise<Object|null>} Default audio device or null
 */
async function getDefaultAudioDevice() {
  const devices = await enumerateAudioDevices();
  if (devices.length === 0) return null;

  // Prefer a device with a meaningful label
  const labeled = devices.find(d => d.label && d.label.trim().length > 0);
  return labeled || devices[0];

/**
 * Check if the browser supports media devices.
 *
 * @returns {boolean}
 */
function isMediaDevicesSupported() {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === 'function' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Check if permissions have been granted for media devices.
 *
 * @returns {boolean}
 */
function hasMediaPermissions() {
  return _permissionGranted;
}

/**
 * Request permissions and then enumerate devices with full labels.
 * Convenience function for initialization.
 *
 * @param {Object} options - Options passed to requestMediaPermissions
 * @returns {Promise<Object>} { videoDevices, audioDevices, permissionsGranted }
 */
async function initializeMediaDevices(options = {}) {
  const permResult = await requestMediaPermissions(options);
  const [videoDevices, audioDevices] = await Promise.all([
    enumerateVideoDevices(),
    enumerateAudioDevices()
  ]);

  return {
    videoDevices,
    audioDevices,
    permissionsGranted: permResult.success
  };
}

/**
 * Handle device change events (plug/unplug).
 * Call this once during app initialization to set up listeners.
 *
 * @param {Function} onChange - Callback function(devices) when device list changes
 * @returns {Function} Cleanup function to remove the listener
 */
function onDeviceChange(onChange) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) {
    return () => {};
  }

  const handler = async () => {
    console.log('[Church Live] Device change detected, re-enumerating...');
    const devices = await enumerateMediaDevices();
    if (onChange) onChange(devices);
  };

  navigator.mediaDevices.addEventListener('devicechange', handler);

  // Return cleanup function
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handler);
  };
}

/**
 * Create a MediaStream from specific device IDs.
 * Useful for previewing a selected camera/microphone.
 *
 * @param {Object} options - Stream options
 * @param {string} options.videoDeviceId - Video device ID (optional)
 * @param {string} options.audioDeviceId - Audio device ID (optional)
 * @returns {Promise<Object>} { success, stream?, error? }
 */
async function createMediaStream(options = {}) {
  const { videoDeviceId, audioDeviceId } = options;

  if (!isMediaDevicesSupported()) {
    return { success: false, error: new Error('MediaDevices API not supported') };
  }

  const constraints = {
    video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : false,
    audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { success: true, stream };
  } catch (error) {
    console.error('[Church Live] Failed to create media stream:', error);
    return { success: false, error };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

window.churchLiveMediaDevices = {
  // Enumeration
  enumerateVideoDevices,
  enumerateAudioDevices,
  enumerateMediaDevices,

  // Permissions
  requestMediaPermissions,
  hasMediaPermissions,

  // Device lookup
  getDeviceById,
  getDeviceLabel,
  getDefaultVideoDevice,
  getDefaultAudioDevice,

  // Utilities
  isMediaDevicesSupported,
  initializeMediaDevices,
  onDeviceChange,
  createMediaStream
};

console.log('[Church Live] Media Devices module loaded');
}
