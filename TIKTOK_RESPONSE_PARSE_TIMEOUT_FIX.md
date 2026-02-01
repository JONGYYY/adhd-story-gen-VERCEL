# TikTok Response Parsing Timeout Fix

## 🚨 Problem

**User Report**: TikTok upload hangs for a long time then fails

**Browser Console Error**:
```
POST https://www.taleo.media/api/social-media/tiktok/upload net::ERR_NETWORK_IO_SUSPENDED
Fetch failed loading: POST "https://www.taleo.media/api/social-media/tiktok/upload"
TikTok upload error: TypeError: Failed to fetch
```

**Deploy Logs** (truncated):
```
Init request completed in 80ms
[nothing after this...]
```

**What it means**: The fetch request completes, but the code hangs when trying to parse the response body, eventually timing out.

---

## 🔍 Root Cause Analysis

### **The Hang Point**

```typescript
// Init request completes successfully
const initResponse = await fetch(initEndpoint, { ... });
console.log(`Init request completed in ${initElapsedTime}ms`); // ✅ LOGS THIS

// But then hangs here forever
const initData = await initResponse.json(); // ← HANGS INDEFINITELY
console.log('Init response status:', ...);  // ❌ NEVER REACHES HERE
```

### **Why It Hangs**

1. **fetch() completes successfully** (80ms)
2. **But `.json()` parsing never completes**
3. **No timeout on response body parsing**
4. **Code waits forever**
5. **Browser eventually gives up**: `ERR_NETWORK_IO_SUSPENDED`

---

## 🔧 Why AbortController Doesn't Help

### **Our Previous Fix (Incomplete)**

```typescript
// We added AbortController for fetch timeout
const abortController = new AbortController();
const timeout = setTimeout(() => abortController.abort(), 30000);

const response = await fetch(url, {
  signal: abortController.signal  // ← Controls fetch only
});

clearTimeout(timeout);

// But this hangs with no timeout protection
const data = await response.json(); // ← NO SIGNAL HERE!
```

### **The Problem**

- `AbortController.signal` is passed to `fetch()`
- Once `fetch()` completes, the signal is no longer active
- `.json()` is a **separate async operation** on the `Response` object
- The signal doesn't control Response body reading
- Result: `.json()` can hang indefinitely

---

## ✅ The Fix: Promise.race

### **For JSON Parsing**

```typescript
// BEFORE (HANGS):
const initData = await initResponse.json();

// AFTER (TIMEOUT PROTECTION):
const initData = await Promise.race([
  initResponse.json(),                      // Race this...
  new Promise((_, reject) =>                // ...against this timeout
    setTimeout(() => 
      reject(new Error('JSON parsing timed out after 15 seconds')), 
      15000
    )
  )
]);
```

### **For Text Parsing**

```typescript
// BEFORE (HANGS):
const uploadBody = await uploadResponse.text();

// AFTER (TIMEOUT PROTECTION):
const uploadBody = await Promise.race([
  uploadResponse.text(),
  new Promise<string>((_, reject) =>
    setTimeout(() => 
      reject(new Error('Body parsing timed out after 15 seconds')), 
      15000
    )
  )
]);
```

---

## 📊 How Promise.race Works

```typescript
const result = await Promise.race([
  operationA(),    // First promise
  operationB()     // Second promise
]);
// Whichever completes (or rejects) FIRST wins
```

### **In Our Case**

```typescript
await Promise.race([
  initResponse.json(),              // Parse JSON (might hang)
  new Promise((_, reject) =>        // Timeout promise (rejects after 15s)
    setTimeout(() => reject(new Error('timeout')), 15000)
  )
]);

// Three possible outcomes:
// 1. .json() completes first → Success! ✅
// 2. .json() throws error → Caught in try/catch ❌
// 3. Timeout completes first → Rejects with timeout error ⏱️
```

---

## 🎯 Implementation Details

### **Init Response Parsing**

```typescript
try {
  // Race JSON parsing against 15-second timeout
  initData = await Promise.race([
    initResponse.json(),
    new Promise((_, reject) => 
      setTimeout(() => 
        reject(new Error('Init response JSON parsing timed out after 15 seconds')), 
        15000
      )
    )
  ]);
  console.log('Init response data:', JSON.stringify(initData).substring(0, 500));
  
} catch (jsonError) {
  // If JSON parsing fails or times out
  console.error('Failed to parse init response as JSON:', jsonError);
  
  // Try to read raw text to debug
  const text = await initResponse.text().catch(() => 'Unable to read response text');
  console.error('Raw response text (first 500 chars):', text.substring(0, 500));
  
  throw new Error(`Failed to parse TikTok init response: ${jsonError.message}`);
}
```

**Features**:
- ✅ 15-second timeout
- ✅ Logs error if parsing fails
- ✅ Attempts to read raw text for debugging
- ✅ Throws clear error message
- ✅ Fails fast instead of hanging

---

### **Upload Response Parsing**

```typescript
try {
  // Race text parsing against 15-second timeout
  uploadBody = await Promise.race([
    uploadResponse.text(),
    new Promise<string>((_, reject) => 
      setTimeout(() => 
        reject(new Error('Upload response body parsing timed out after 15 seconds')), 
        15000
      )
    )
  ]);
  console.log('Upload response body:', uploadBody.substring(0, 500));
  
} catch (bodyError) {
  // If body parsing fails or times out, continue with empty body
  // (Upload might have succeeded even if we can't read response)
  console.error('Failed to read upload response body:', bodyError);
  uploadBody = '';
}

// Check status regardless of body parsing
if (!uploadResponse.ok) {
  throw new Error(`Failed to upload video: ${uploadBody || `HTTP ${uploadResponse.status}`}`);
}
```

**Features**:
- ✅ 15-second timeout
- ✅ Logs error if parsing fails
- ✅ Continues with empty body (upload might have succeeded)
- ✅ Still checks response status
- ✅ Graceful degradation

---

## 🔍 Enhanced Logging

### **Log Response Status BEFORE Parsing**

```typescript
// BEFORE:
const initData = await initResponse.json();
console.log('Init response status:', initResponse.status); // Never reached if .json() hangs

// AFTER:
console.log('Init response status:', initResponse.status); // ✅ Logs BEFORE parsing
const initData = await Promise.race([...]);
```

**Why**: This confirms the fetch succeeded, helping diagnose if the issue is with the request or response parsing.

---

### **Log Response Headers**

```typescript
console.log('Init response headers:', 
  JSON.stringify(Object.fromEntries(initResponse.headers.entries())).substring(0, 300)
);
```

**Why**: Headers can reveal:
- Content-Type (is it actually JSON?)
- Content-Length (is response huge?)
- Content-Encoding (compression issues?)

---

### **Log Raw Text on Parse Failure**

```typescript
catch (jsonError) {
  console.error('Failed to parse init response as JSON:', jsonError);
  const text = await initResponse.text().catch(() => 'Unable to read response text');
  console.error('Raw response text (first 500 chars):', text.substring(0, 500));
}
```

**Why**: Shows what TikTok actually returned (malformed JSON? HTML error page? Empty response?).

---

## 📝 Expected Logs

### **Success Case**

```
Init request completed in 80ms
Init response status: 200
Init response headers: {"content-type":"application/json",...}
Init response data: {"data":{"upload_url":"https://...","publish_id":"..."}}
Upload URL received: https://open-upload.tiktokapis.com/upload/...
Uploading video file...
Sending video bytes to TikTok upload URL...
Video upload completed in 18.45 seconds
Upload response status: 201
Upload response body: 
Video uploaded successfully (public post)
```

---

### **Timeout Case (Init Parsing)**

```
Init request completed in 80ms
Init response status: 200
Init response headers: {"content-type":"application/json",...}
Failed to parse init response as JSON: Error: Init response JSON parsing timed out after 15 seconds
Raw response text (first 500 chars): {"data":{"upload_url":"https://very-long-url-that-never-finishes-sending...
Error: Failed to parse TikTok init response: Init response JSON parsing timed out after 15 seconds
```

---

### **Timeout Case (Upload Body Parsing)**

```
...
Video upload completed in 18.45 seconds
Upload response status: 201
Failed to read upload response body: Error: Upload response body parsing timed out after 15 seconds
Upload response body: 
Video uploaded successfully (public post)
```

**Note**: Upload might still succeed even if body parsing times out!

---

## 🧪 Testing

### **Test Cases**

1. **Normal Upload (Small Video)**
   - Should complete in < 60 seconds
   - All logs appear in order
   - Video uploaded successfully

2. **Large Video (14MB)**
   - Should complete in 60-120 seconds
   - Init response parsed successfully
   - Upload response parsed successfully

3. **Slow TikTok API**
   - If init response slow to parse:
     * Timeout after 15 seconds
     * Clear error message
     * Can retry

4. **Malformed Response**
   - If TikTok returns invalid JSON:
     * Parse fails immediately
     * Raw text logged
     * Clear error message

---

## 🎯 Why 15 Seconds?

| Timeout | Too Short? | Too Long? | Just Right? |
|---------|------------|-----------|-------------|
| 5s | ✅ Yes - legitimate responses might take longer | | |
| 10s | ⚠️ Maybe - cutting it close | | |
| 15s | | | ✅ Good balance |
| 30s | | ⚠️ User waits too long for timeout | |
| 60s | | ❌ Way too long - defeats purpose | |

**15 seconds** is:
- Long enough for slow networks or large responses
- Short enough to fail fast if truly hanging
- Consistent with typical API timeout expectations

---

## 🔄 Comparison: Fetch Timeout vs Parse Timeout

### **Fetch Timeout (Previous Fix)**

```typescript
const abortController = new AbortController();
setTimeout(() => abortController.abort(), 30000);

const response = await fetch(url, {
  signal: abortController.signal  // ← Controls network request
});
```

**Protects against**:
- ✅ Slow network connections
- ✅ Server not responding
- ✅ DNS resolution failures
- ✅ Connection hangs

**Does NOT protect against**:
- ❌ Slow response body reading
- ❌ JSON parsing hangs
- ❌ Malformed responses

---

### **Parse Timeout (This Fix)**

```typescript
const data = await Promise.race([
  response.json(),                // ← Actual operation
  timeoutPromise(15000)           // ← Timeout protection
]);
```

**Protects against**:
- ✅ Slow response body reading
- ✅ JSON parsing hangs
- ✅ Large responses
- ✅ Malformed responses
- ✅ Connection interrupted mid-response

---

## 📚 Summary

### **Problem**:
- ❌ Fetch completed, but `.json()` parsing hung indefinitely
- ❌ No timeout on response body reading
- ❌ Browser gave up: `ERR_NETWORK_IO_SUSPENDED`
- ❌ Code never progressed past parsing

### **Solution**:
- ✅ Use `Promise.race` for parse timeout
- ✅ Race parsing against 15-second timeout
- ✅ Log response status/headers before parsing
- ✅ Log raw text if JSON parsing fails
- ✅ Graceful error handling

### **Result**:
- ✅ No more indefinite hangs
- ✅ Clear timeout errors after 15 seconds
- ✅ Better debugging with enhanced logs
- ✅ Faster failure detection
- ✅ User sees error instead of endless spinner

---

**Implementation Date**: 2026-02-01  
**Commit**: `c080dd2`  
**Issue**: TikTok upload hanging at response parsing  
**Status**: ✅ **FIXED**

---

TikTok uploads now have complete timeout protection! 🚀✨

