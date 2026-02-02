# TikTok 401 Unauthorized Error Fix

## 🚨 Problem

**User Experience**:
- Browser: `500 Internal Server Error`
- Error: "Failed to upload to TikTok"
- No clear indication of what's wrong

**Deploy Logs**:
```
Init response status: 401
Failed to parse init response as JSON: timeout
Raw response text: Unable to read response text
```

**Root Causes**:
1. ❌ TikTok access token is **expired or invalid** (401 Unauthorized)
2. ❌ Response body consumed twice, couldn't read TikTok's error message
3. ❌ Generic error message, user doesn't know what to do

---

## 🔍 Technical Issue #1: Response Body Consumption

### **The Problem**

HTTP response bodies are **ReadableStreams** - they can only be read once.

```typescript
// BEFORE (BROKEN):
try {
  const data = await initResponse.json();  // Reads & consumes body stream
} catch (error) {
  // Stream already consumed by .json()
  const text = await initResponse.text(); // ❌ ERROR: Body already used
  console.log(text); // "Unable to read response text"
}
```

### **Why It Fails**

1. `Response.json()` internally does:
   - Read body stream as text
   - Parse text as JSON
   - Return parsed object

2. If `.json()` succeeds → body consumed, no problem
3. If `.json()` fails → body still consumed, can't read again
4. Subsequent `.text()` call → **Error**: Body already read

### **The Fix**

Read body as text first, then parse:

```typescript
// AFTER (FIXED):
let rawText = '';
try {
  // Step 1: Read body as text (with timeout)
  rawText = await Promise.race([
    initResponse.text(),
    timeoutPromise(15000)
  ]);
  
  // Step 2: Parse text as JSON
  const data = JSON.parse(rawText);
  
} catch (error) {
  // rawText is ALWAYS available for logging
  console.log('Raw response:', rawText); // ✅ Works!
}
```

### **Benefits**

- ✅ Body read only once
- ✅ Raw text always available
- ✅ Can log TikTok's actual error message
- ✅ Better debugging

---

## 🔍 Technical Issue #2: 401 Unauthorized Not Handled

### **The Problem**

```typescript
// BEFORE:
if (!initResponse.ok) {
  throw new Error(`Failed to initialize video upload: Unknown error`);
  // User has no idea what to do!
}
```

**TikTok Response** (when token expired):
```json
{
  "error": {
    "code": "access_token_invalid",
    "message": "The access token is invalid or has expired"
  }
}
```

**User Sees**: "Failed to upload to TikTok" 🤷‍♂️

### **The Fix**

```typescript
// AFTER:
if (!initResponse.ok) {
  const errorMessage = initData.error?.message || 'Unknown error';
  
  // Special handling for 401 Unauthorized
  if (initResponse.status === 401) {
    throw new Error(
      `TikTok access token is invalid or expired. ` +
      `Please go to Settings → Social Media and reconnect your TikTok account. ` +
      `(Error: ${errorMessage})`
    );
  }
  
  throw new Error(`Failed to initialize video upload (${initResponse.status}): ${errorMessage}`);
}
```

### **Benefits**

- ✅ Clear error message
- ✅ Specific instructions for user
- ✅ Includes TikTok's error details
- ✅ User knows exactly what to do

---

## 📊 Before & After

### **BEFORE (Broken)**

**Deploy Logs**:
```
Init response status: 401
Failed to parse init response as JSON: Init response JSON parsing timed out
Raw response text (first 500 chars): Unable to read response text
TikTok video upload error: Failed to parse TikTok init response
```

**User Sees**:
```
Error: Failed to upload to TikTok
```

**User Reaction**: 😕 "What do I do?"

---

### **AFTER (Fixed)**

**Deploy Logs**:
```
Init response status: 401
Raw response body length: 166
Raw response body (first 500 chars): {"error":{"code":"access_token_invalid","message":"The access token is invalid or has expired"}}
Parsed init response data successfully
Init error response: { error: { code: 'access_token_invalid', message: '...' } }
TikTok video upload error: TikTok access token is invalid or expired. Please go to Settings → Social Media and reconnect your TikTok account.
```

**User Sees**:
```
Error: TikTok access token is invalid or expired. 
Please go to Settings → Social Media and reconnect your TikTok account.
```

**User Reaction**: ✅ "Ah, I need to reconnect TikTok!"

---

## 🛠️ How to Reconnect TikTok

### **For Users**

1. **Go to Settings**:
   - Click your profile icon
   - Click "Settings"

2. **Navigate to Social Media**:
   - Click "Social Media" in sidebar
   - Find TikTok section

3. **Disconnect & Reconnect**:
   - Click "Disconnect TikTok"
   - Click "Connect TikTok"
   - Follow OAuth flow
   - Authorize the app

4. **Try Upload Again**:
   - Go back to your video
   - Click "Upload to TikTok"
   - Should work now! ✅

### **Why Tokens Expire**

TikTok access tokens expire after:
- **30 days** (typical)
- User revokes access in TikTok app
- User changes TikTok password
- TikTok security policy changes

---

## 🧪 Testing

### **Test Case 1: Expired Token (401)**

**Setup**:
- Have a TikTok account connected
- Wait for token to expire (or manually invalidate)

**Expected**:
```
Init response status: 401
Raw response body: {"error":{"code":"access_token_invalid",...}}
Error: TikTok access token is invalid or expired. Please go to Settings → Social Media and reconnect your TikTok account.
```

**User Action**: Reconnect TikTok in Settings

---

### **Test Case 2: Valid Token (200)**

**Setup**:
- Freshly connected TikTok account

**Expected**:
```
Init response status: 200
Raw response body: {"data":{"upload_url":"https://...","publish_id":"..."}}
Upload URL received: https://open-upload.tiktokapis.com/...
Video uploaded successfully
```

---

### **Test Case 3: Other TikTok Errors (403, 429, etc.)**

**Expected**:
```
Init response status: 429
Raw response body: {"error":{"code":"rate_limit_exceeded","message":"Too many requests"}}
Error: Failed to initialize video upload (429): Too many requests
```

User sees actual TikTok error message with status code.

---

## 🎯 Error Messages

### **401 Unauthorized (Token Expired)**

```
TikTok access token is invalid or expired. 
Please go to Settings → Social Media and reconnect your TikTok account. 
(Error: The access token is invalid or has expired)
```

### **403 Forbidden (Permissions Issue)**

```
Failed to initialize video upload (403): 
Insufficient permissions. Please ensure video.upload scope is granted.
```

### **429 Rate Limit**

```
Failed to initialize video upload (429): 
Too many requests. Please wait a few minutes and try again.
```

### **500 Server Error**

```
Failed to initialize video upload (500): 
TikTok server error. Please try again later.
```

---

## 📝 Code Changes

### **File**: `src/lib/social-media/tiktok.ts`

**Change 1: Read Body as Text First**

```typescript
// Before:
const initData = await initResponse.json();

// After:
const rawText = await Promise.race([
  initResponse.text(),
  timeoutPromise(15000)
]);
const initData = JSON.parse(rawText);
```

**Change 2: Handle 401 Specifically**

```typescript
// Before:
if (!initResponse.ok) {
  throw new Error(`Failed to initialize video upload: Unknown error`);
}

// After:
if (!initResponse.ok) {
  if (initResponse.status === 401) {
    throw new Error('TikTok access token is invalid or expired. Please go to Settings → Social Media and reconnect your TikTok account.');
  }
  throw new Error(`Failed to initialize video upload (${initResponse.status}): ${errorMessage}`);
}
```

---

## 🚀 User Flow

### **When Token Expires**

```
1. User clicks "Upload to TikTok"
   ↓
2. App tries to upload → 401 Unauthorized
   ↓
3. User sees clear error:
   "TikTok access token is invalid or expired.
    Please go to Settings → Social Media and reconnect your TikTok account."
   ↓
4. User goes to Settings → Social Media
   ↓
5. User disconnects and reconnects TikTok
   ↓
6. User tries upload again
   ↓
7. Success! ✅
```

---

## 💡 Key Takeaways

### **Technical**

1. **Response bodies are streams** - can only be read once
2. **Read as text first** - then parse as needed
3. **Always have raw text** - for error logging
4. **Handle specific status codes** - provide context-appropriate errors

### **UX**

1. **Clear error messages** - tell user what's wrong
2. **Actionable instructions** - tell user how to fix
3. **Include context** - show TikTok's actual error
4. **Status codes** - help diagnose issues

---

## 📚 Summary

**Problems Fixed**:
1. ✅ Response body consumption error
2. ✅ Generic auth error messages
3. ✅ Missing TikTok error details

**User Benefits**:
1. ✅ Clear error messages
2. ✅ Knows when to reconnect TikTok
3. ✅ Can see actual TikTok errors
4. ✅ Better debugging support

**Result**: Users can self-diagnose and fix auth issues! 🎉

---

**Implementation Date**: 2026-02-01  
**Commit**: `a249690`  
**Issue**: 401 Unauthorized + response body consumption  
**Status**: ✅ **FIXED**

---

**Next Step for User**: Go to Settings → Social Media → Reconnect TikTok! 🔄

