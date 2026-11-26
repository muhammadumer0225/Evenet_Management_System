import { reconnectSocket } from './socket';
/**
 * Service layer. Every function here maps 1:1 to a REST endpoint you would build in Express.
 * Example: login()  ->  POST /api/auth/login
 *          saveExpo() -> POST /api/expos  |  PUT /api/expos/:id
 * Swap the bodies for axios calls when the backend is available; the UI will not change.
 */
import { getState, mutate } from './store';
import { genBooths, hashPw} from './seed';
import { uid, ymd, isEmail } from './utils';
import { normalizeUser } from './normalizers';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const SESSION_KEY = 'eventsphere.session';

export const getSessionUserId = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const setSession = (id) => {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('eventsphere:session'));
};

/* ---------------- helpers (operate on draft) ---------------- */
const pushNote = (d, userId, title, text, type = 'info', link = null) => {
  if (!userId) return;
  d.notifications.unshift({ id: uid('n'), userId, title, text, type, link, read: false, createdAt: new Date().toISOString() });
  if (d.notifications.length > 400) d.notifications.length = 400;
};
const pushActivity = (d, text) => {
  d.activity.unshift({ id: uid('a'), text, createdAt: new Date().toISOString() });
  if (d.activity.length > 60) d.activity.length = 60;
};
const admins = (d) => d.users.filter((u) => u.role === 'admin' && u.status === 'active');
const publicUser = (u) => {
  if (!u) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...rest } = u;
  return rest;
};

/* ---------------- Auth ---------------- */

export async function login(email, password) {
  const response = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login failed. Please try again.');
  }

  // Save authentication tokens
  localStorage.setItem('eventsphere.token', data.token);
  localStorage.setItem('eventsphere.refreshToken', data.refreshToken);

  // Save logged-in user
  localStorage.setItem('eventsphere.user', JSON.stringify(data.user));

  // Keep existing session event system working
  setSession(data.user.id);

  return data.user;
}



export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('eventsphere.refreshToken');

  if (!refreshToken) {
    throw new Error('Refresh token not found. Please login again.');
  }

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Session expired. Please login again.');
  }

  localStorage.setItem('eventsphere.token', data.token);
  localStorage.setItem('eventsphere.refreshToken', data.refreshToken);
  reconnectSocket();

  return data.token;
}

export async function apiRequest(url, options = {}) {
  let token = localStorage.getItem('eventsphere.token');

  const makeRequest = (accessToken) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(accessToken && {
          Authorization: `Bearer ${accessToken}`,
        }),
      },
    });
  };

  let response = await makeRequest(token);

  if (response.status === 401) {
    try {
      token = await refreshAccessToken();
      response = await makeRequest(token);

      if (response.status === 401) {
        await logout();
      }

    } catch (error) {
      await logout();
      throw error;
    }
  }

  return response;
}


export async function getMyExhibitorProfile() {
  const response = await apiRequest('/api/exhibitors/me');
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(data.message || 'Unable to load exhibitor profile.');
  }

  return data.profile;
}

export async function getPublicExhibitorProfile(id) {
  const response = await apiRequest(
    `/api/exhibitors/${id}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Unable to load exhibitor profile.'
    );
  }

  return data;
}


/* ---------------- Announcements ---------------- */

export async function getMyAnnouncements() {
  const response = await apiRequest('/api/announcements/my');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load announcements.');
  }

  return data.announcements;
}

export async function getAllAnnouncements() {
  const response = await apiRequest('/api/announcements');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load announcements.');
  }

  return data;
}

export async function createAnnouncement(payload) {
  const response = await apiRequest('/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to create announcement.');
  }

  return data.announcement;
}

export async function updateAnnouncement(id, payload) {
  const response = await apiRequest(`/api/announcements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update announcement.');
  }

  return data.announcement;
}

export async function deleteAnnouncement(id) {
  const response = await apiRequest(`/api/announcements/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to delete announcement.');
  }

  return data;
}



export async function getMyApplications() {
  const response = await apiRequest('/api/applications/mine');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch applications.');
  }

  return data.applications || [];
}



export async function getAllApplications({
  status = '',
  expoId = '',
  search = '',
  page = 1,
  limit = 100,
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status && status !== 'all') params.set('status', status);
  if (expoId) params.set('expoId', expoId);
  if (search) params.set('search', search);

  const response = await apiRequest(
    `/api/applications?${params.toString()}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch applications.');
  }

  return data;
}



export async function approveExhibitorApplication(id, remarks = '') {
  const response = await apiRequest(`/api/applications/${id}/approve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ remarks }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to approve application.');
  }

  return data.application;
}



export async function rejectExhibitorApplication(id, remarks) {
  const response = await apiRequest(`/api/applications/${id}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ remarks }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to reject application.');
  }

  return data.application;
}



export async function createExhibitorProfile(profile) {
  const response = await apiRequest('/api/exhibitors/me', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to create exhibitor profile.');
  }

  return data.profile;
}

export async function updateMyExhibitorProfile(profile) {
  const response = await apiRequest('/api/exhibitors/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update exhibitor profile.');
  }

  return data.profile;
}


export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await apiRequest('/api/images/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to upload image.');
  }

  return data.image.url;
}



export async function uploadApplicationDocuments(files) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('documents', file);
  });

  const response = await apiRequest('/api/application-documents/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to upload documents.');
  }

  return data.documents;
}




export async function getProfile() {
  const response = await apiRequest('/api/auth/profile');

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch profile.');
  }

  return { ...data, user: normalizeUser(data.user) };
}


/* ---------------- Expo Backend APIs ---------------- */

export async function getExpos() {
  const response = await apiRequest('/api/expos/manage?limit=100');

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch expos.');
  }

  return data.expos;
}


/* ---------------- Public Expo APIs ---------------- */


export async function getPublishedExpos() {
  const response = await apiRequest('/api/expos?limit=100');

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch published expos.');
  }

  return data.expos || [];
}



export async function getExpoById(expoId, isAdmin = false) {
  const endpoint = isAdmin
    ? `/api/expos/manage/${expoId}`
    : `/api/expos/${expoId}`;

  const response = await apiRequest(endpoint);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch expo details.');
  }

  return data.expo;
}



/* ---------------- Expo Registration & Demo Payment APIs ---------------- */

export async function registerForExpoApi(expoId, ticketTier) {
  const response = await apiRequest(
    `/api/expo-registrations/${expoId}/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ticketTier: ticketTier.toLowerCase() }),
    }
  );

const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to register for Expo.');
  }

  return data;
}

export async function getMyExpoRegistrationsApi() {
  const response = await apiRequest('/api/expo-registrations/my');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch registrations.');
  }

  return data.registrations || [];
}

export async function completeDemoPaymentApi(registrationId) {
  const response = await apiRequest(
    `/api/payments/demo/complete/${registrationId}`,
    {
      method: 'POST',
    }
  );

const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Demo payment failed.');
  }

  return data;
}


export async function cancelExpoRegistrationApi(registrationId) {
  const response = await apiRequest(
    `/api/expo-registrations/${registrationId}/cancel`,
    {
      method: 'PATCH',
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to cancel Expo registration.');
  }

  return data;
}


const sessionRegistrationsPromises = new Map();

export async function getMySessionRegistrationsApi({ userId = 'current' } = {}) {
  const cacheKey = String(userId || 'current');
  if (sessionRegistrationsPromises.has(cacheKey)) return sessionRegistrationsPromises.get(cacheKey);

  const request = (async () => {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await apiRequest(`/api/session-registrations/my?page=${page}&limit=100`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load your session registrations.');
      all.push(...(data.registrations || []));
      totalPages = Math.max(1, Number(data.pagination?.totalPages || 1));
      page += 1;
    } while (page <= totalPages);
    return all;
  })();
  sessionRegistrationsPromises.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (sessionRegistrationsPromises.get(cacheKey) === request) sessionRegistrationsPromises.delete(cacheKey);
  }
}

const invalidateSessionRegistrationsCache = () => sessionRegistrationsPromises.clear();

export async function registerForSessionApi(sessionId) {
  const response = await apiRequest(`/api/session-registrations/${sessionId}/register`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to register for this session.');
  invalidateSessionRegistrationsCache();
  return data.registration;
}

export async function cancelSessionRegistrationApi(registrationId) {
  const response = await apiRequest(`/api/session-registrations/${registrationId}/cancel`, { method: 'PATCH' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to cancel this session registration.');
  invalidateSessionRegistrationsCache();
  return data.registration;
}

export async function bookmarkSessionApi(sessionId) {
  const response = await apiRequest(`/api/session-registrations/${sessionId}/bookmark`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to bookmark this session.');
  invalidateSessionRegistrationsCache();
  return data.registration;
}

export async function removeSessionBookmarkApi(sessionId) {
  const response = await apiRequest(`/api/session-registrations/${sessionId}/bookmark`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to remove this bookmark.');
  invalidateSessionRegistrationsCache();
  return data;
}

export async function verifyMyRegistrationApi(registrationId) {
  const response = await apiRequest(`/api/expo-registrations/verify/${encodeURIComponent(registrationId.trim())}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to verify this registration.');
  return data;
}

export async function checkInAttendeeApi({ registrationId, ticketCode, expoId } = {}) {
  const response = await apiRequest('/api/expo-registrations/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationId, ticketCode, expoId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to check in attendee.');
  return data;
}

export async function recordBoothVisitApi(boothId, { registrationId, ticketCode, source } = {}) {
  const response = await apiRequest(`/api/booths/${encodeURIComponent(boothId)}/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationId, ticketCode, source }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to record booth visit.');
  return data;
}

export async function getPublishedSessions() {
  const firstResponse = await apiRequest('/api/sessions?page=1&limit=100');
  const firstData = await firstResponse.json();
  if (!firstResponse.ok) throw new Error(firstData.message || 'Unable to load sessions.');
  const sessions = [...(firstData.sessions || [])];
  const totalPages = Number(firstData.pagination?.totalPages || 1);
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await apiRequest(`/api/sessions?page=${page}&limit=100`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load sessions.');
    sessions.push(...(data.sessions || []));
  }
  return sessions;
}

export async function getExpoSessions(expoId, isAdmin = false) {
  const endpoint = isAdmin
    ? `/api/sessions/manage?expo=${expoId}&limit=100`
    : `/api/sessions?expo=${expoId}&limit=100`;

  const response = await apiRequest(endpoint);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch expo sessions.');
  }

  return data.sessions || [];
}

export async function getSpeakers() {
  const response = await apiRequest('/api/speakers?limit=100');
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load speakers.');
  return data.speakers || [];
}

export async function createSessionApi(payload) {
  const response = await apiRequest('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to create session.');
  return data.session;
}

export async function updateSessionApi(sessionId, payload) {
  const response = await apiRequest(`/api/sessions/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to update session.');
  return data.session;
}

export async function deleteSessionApi(sessionId) {
  const response = await apiRequest(`/api/sessions/${sessionId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to cancel session.');
  return data;
}


/* ---------------- Booth Backend APIs ---------------- */

export async function getBooths(expoId) {
  const response = await apiRequest(
    `/api/booths?expo=${expoId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch booths.');
  }

  return data.booths;
}


export async function getExpoFloorPlan(expoId) {
  const response = await apiRequest(
    `/api/booths/floor-plan/${expoId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch Expo floor plan.');
  }

  return data;
}


export async function reserveBoothApi(boothId) {
  const response = await apiRequest(`/api/booths/${boothId}/reserve`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to reserve booth.');
  }

  return data.booth;
}

export async function assignBoothToApplicationApi(boothId, applicationId) {
  const response = await apiRequest(`/api/booths/${boothId}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ applicationId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to assign booth.');
  }

  return data;
}

export async function releaseBoothApi(boothId) {
  const response = await apiRequest(`/api/booths/${boothId}/release`, {
    method: 'PATCH',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to release booth.');
  }

  return data.booth;
}


export async function createBooth(boothData) {
  const response = await apiRequest('/api/booths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boothData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to create booth.');
  }

  return data.booth;
}

export async function updateBoothAPI(boothId, boothData) {
  const response = await apiRequest(`/api/booths/${boothId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boothData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update booth.');
  }

  return data.booth;
}


export async function setBoothAvailabilityAPI(boothId, status) {
  const response = await apiRequest(`/api/booths/${boothId}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update booth availability.');
  }

  return data.booth;
}


export async function deleteBooth(boothId) {
  const response = await apiRequest(`/api/booths/${boothId}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to delete booth.');
  }

  return data;
}


export async function createExpo(expoData) {
  const response = await apiRequest('/api/expos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expoData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to create expo.');
  }

  return data.expo;
}

export async function updateExpo(expoId, expoData) {
  const response = await apiRequest(`/api/expos/${expoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expoData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update expo.');
  }

  return data.expo;
}

export async function removeExpo(expoId) {
  const response = await apiRequest(`/api/expos/${expoId}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to delete expo.');
  }

  return data;
}






export async function register({
  name,
  email,
  password,
  role,
  company,
  phone,
  orgCode,
}) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      email,
      password,
      role,
      company,
      phone,
      orgCode,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Registration failed.');
  }

  // Signup ke baad automatically login
  return await login(email, password);
}


export async function logout() {
  const refreshToken = localStorage.getItem('eventsphere.refreshToken');

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    console.error('Logout API error:', error);
  } finally {
    localStorage.removeItem('eventsphere.token');
    localStorage.removeItem('eventsphere.refreshToken');
    localStorage.removeItem('eventsphere.user');

    setSession(null);
  }
}


export async function requestPasswordReset(email) {
  if (!isEmail(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Unable to process password reset request.'
    );
  }

  return data;
}


export function checkResetToken(token) {
  const t = (getState().resetTokens || []).find((x) => x.token === token);
  return !!t && t.expiresAt > Date.now();
}


export async function resetPassword(token, password) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
  resetToken: token,
  newPassword: password,
}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Password reset failed. Please try again.'
    );
  }

  return data;
}


function cascadeDeleteUser(s, userId) {
  s.booths.forEach((b) => {
    if (b.exhibitorId === userId) Object.assign(b, { exhibitorId: null, appId: null, status: 'available', showcase: null });
  });
  s.applications = s.applications.filter((a) => a.exhibitorId !== userId);
  s.registrations = s.registrations.filter((r) => r.userId !== userId);
  s.sessionRegs = s.sessionRegs.filter((r) => r.userId !== userId);
  s.messages = s.messages.filter((m) => m.from !== userId && m.to !== userId);
  s.notifications = s.notifications.filter((n) => n.userId !== userId);
  s.users = s.users.filter((u) => u.id !== userId);
}



/* ---------------- Account Backend APIs ---------------- */

export async function updateProfile(userId, patch) {
  const response = await apiRequest('/api/account/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update profile.');
  }

  const user = normalizeUser(data.user);
  localStorage.setItem('eventsphere.user', JSON.stringify(user));
  window.dispatchEvent(new Event('eventsphere:session'));

  return user;
}

export async function uploadProfileImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await apiRequest('/api/account/profile-image', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to upload profile picture.');
  const user = normalizeUser(data.user);
  localStorage.setItem('eventsphere.user', JSON.stringify(user));
  window.dispatchEvent(new Event('eventsphere:session'));
  return user;
}

export async function changePassword(userId, current, next) {
  const response = await apiRequest('/api/account/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: current,
      newPassword: next,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to change password.');
  }

  return data;
}

export async function exportMyData(userId) {
  const response = await apiRequest('/api/account/export');

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Unable to export account data.');
  }

  return await response.json();
}

export async function deleteAccount(userId) {
  const response = await apiRequest('/api/account', {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to delete account.');
  }

  await logout();

  return data;
}


/* ---------------- Users (admin) ---------------- */
export function setUserStatus(userId, status) {
  mutate((s) => {
    s.users.find((u) => u.id === userId).status = status;
  });
}
export function deleteUser(userId) {
  mutate((s) => cascadeDeleteUser(s, userId));
}

/* ---------------- Expos ---------------- */
export function saveExpo(data) {
  if (!data.title?.trim()) throw new Error('Title is required.');
  if (!data.startDate || !data.endDate) throw new Error('Start and end dates are required.');
  if (data.endDate < data.startDate) throw new Error('End date cannot be before the start date.');
  if (!data.location?.trim()) throw new Error('Location is required.');
  return mutate((s) => {
    if (data.id) {
      const e = s.expos.find((x) => x.id === data.id);
      const statusChanged = e.status !== data.status;
      Object.assign(e, data);
      if (statusChanged && data.status === 'live')
        s.registrations.filter((r) => r.expoId === e.id).forEach((r) => pushNote(s, r.userId, `${e.title} is live!`, 'Doors are open. Check the schedule and floor plan.', 'success', `/expos/${e.id}`));
      pushActivity(s, `Expo “${e.title}” was updated`);
      return e.id;
    }
    const id = uid('e');
    const expo = {
      hue: Math.floor(Math.random() * 360), daily: [], tags: [], capacity: 1000, ticketPrice: 10, theme: '',
      layout: { rows: 5, cols: 8 }, organizerId: null, ...data, id,
    };
    s.expos.push(expo);
    s.booths.push(...genBooths(id, expo.layout.rows, expo.layout.cols));
    pushActivity(s, `New expo created: “${expo.title}”`);
    return id;
  });
}

export function deleteExpo(id) {
  mutate((s) => {
    s.expos = s.expos.filter((e) => e.id !== id);
    s.booths = s.booths.filter((b) => b.expoId !== id);
    s.applications = s.applications.filter((a) => a.expoId !== id);
    const sids = s.sessions.filter((x) => x.expoId === id).map((x) => x.id);
    s.sessions = s.sessions.filter((x) => x.expoId !== id);
    s.sessionRegs = s.sessionRegs.filter((r) => !sids.includes(r.sessionId));
    s.registrations = s.registrations.filter((r) => r.expoId !== id);
  });
}

/* ---------------- Booths / floor plan ---------------- */
export function generateLayout(expoId, rows, cols) {
  rows = Math.max(1, Math.min(8, Number(rows)));
  cols = Math.max(2, Math.min(12, Number(cols)));
  mutate((s) => {
    const old = s.booths.filter((b) => b.expoId === expoId);
    const fresh = genBooths(expoId, rows, cols);
    fresh.forEach((nb) => {
      const ob = old.find((b) => b.label === nb.label);
      if (ob) Object.assign(nb, { status: ob.status, exhibitorId: ob.exhibitorId, appId: ob.appId, showcase: ob.showcase, visits: ob.visits, note: ob.note });
    });
    // release dropped booths
    old.forEach((ob) => {
      if (!fresh.find((nb) => nb.label === ob.label) && ob.appId) {
        const a = s.applications.find((x) => x.id === ob.appId);
        if (a) a.boothId = null;
        pushNote(s, ob.exhibitorId, 'Booth reassigned', `Your booth ${ob.label} was removed in a floor-plan update. Please pick a new one.`, 'warning', '/dashboard/booth');
      }
    });
    s.booths = s.booths.filter((b) => b.expoId !== expoId).concat(fresh);
    s.expos.find((e) => e.id === expoId).layout = { rows, cols };
    pushActivity(s, `Floor plan regenerated (${rows}×${cols})`);
  });
}

export function updateBooth(boothId, patch) {
  mutate((s) => {
    const b = s.booths.find((x) => x.id === boothId);
    const expo = s.expos.find((e) => e.id === b.expoId);
    const { exhibitorId, ...rest } = patch;
    Object.assign(b, rest);
    // free
    if (rest.status === 'available' || rest.status === 'blocked') {
      if (b.appId) {
        const a = s.applications.find((x) => x.id === b.appId);
        if (a) a.boothId = null;
        pushNote(s, b.exhibitorId, 'Booth released', `Booth ${b.label} at ${expo.title} was released by the organizer.`, 'warning', '/dashboard/booth');
      }
      b.exhibitorId = null;
      b.appId = null;
      b.showcase = null;
    }
    // assign
    if (exhibitorId !== undefined && exhibitorId) {
      const app = s.applications.find((a) => a.expoId === b.expoId && a.exhibitorId === exhibitorId && a.status === 'approved');
      if (!app) throw new Error('That exhibitor has no approved application for this expo.');
      if (b.appId && b.appId !== app.id) {
        const prev = s.applications.find((x) => x.id === b.appId);
        if (prev) prev.boothId = null;
      }
      // free exhibitor's previous booth
      s.booths.filter((x) => x.expoId === b.expoId && x.appId === app.id && x.id !== b.id).forEach((x) => {
        Object.assign(x, { status: 'available', exhibitorId: null, appId: null, showcase: null });
      });
      Object.assign(b, { exhibitorId, appId: app.id, status: 'booked' });
      app.boothId = b.id;
      pushNote(s, exhibitorId, 'Booth allocated', `Booth ${b.label} (${b.zone}) at ${expo.title} has been allocated to you.`, 'success', '/dashboard/showcase');
      pushActivity(s, `Booth ${b.label} allocated to ${app.company}`);
    }
  });
}

export function reserveBooth(boothId, userId) {
  mutate((s) => {
    const b = s.booths.find((x) => x.id === boothId);
    if (!b || b.status !== 'available') throw new Error('Sorry — that booth was just taken. Please choose another.');
    const app = s.applications.find((a) => a.expoId === b.expoId && a.exhibitorId === userId && a.status === 'approved');
    if (!app) throw new Error('You need an approved application for this expo first.');
    if (app.boothId) throw new Error('You already have a booth for this expo. Release it first to pick another.');
    Object.assign(b, { status: 'reserved', exhibitorId: userId, appId: app.id });
    app.boothId = b.id;
    const expo = s.expos.find((e) => e.id === b.expoId);
    admins(s).forEach((a) => pushNote(s, a.id, 'Booth reserved', `${app.company} reserved booth ${b.label} for ${expo.title}. Confirm it.`, 'info', '/dashboard/booths'));
    pushActivity(s, `${app.company} reserved booth ${b.label}`);
  });
}

export function releaseBooth(boothId) {
  mutate((s) => {
    const b = s.booths.find((x) => x.id === boothId);
    const a = s.applications.find((x) => x.id === b.appId);
    if (a) a.boothId = null;
    Object.assign(b, { status: 'available', exhibitorId: null, appId: null, showcase: null });
  });
}

export function confirmBooth(boothId) {
  mutate((s) => {
    const b = s.booths.find((x) => x.id === boothId);
    b.status = 'booked';
    const expo = s.expos.find((e) => e.id === b.expoId);
    pushNote(s, b.exhibitorId, 'Booth confirmed', `Booth ${b.label} at ${expo.title} is confirmed. Set up your showcase!`, 'success', '/dashboard/showcase');
  });
}


export async function getMyShowcase() {
  const response = await apiRequest('/api/booths/my-showcase');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load booth showcase.');
  }

  return data.booths || [];
}

const buildAnalyticsDateQuery = ({ from = '', to = '' } = {}) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export async function getMyBoothAnalytics(dateRange = {}) {
  const response = await apiRequest(`/api/exhibitors/me/booth-analytics${buildAnalyticsDateQuery(dateRange)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Unable to load booth analytics.');
  }
  return data.analytics || { summary: {}, booths: [], dailyVisits: [] };
}

export async function downloadMyBoothAnalyticsPdf(dateRange = {}) {
  const response = await apiRequest(`/api/exhibitors/me/booth-analytics/report.pdf${buildAnalyticsDateQuery(dateRange)}`);
  if (!response.ok) {
    let message = 'Unable to export booth analytics PDF.';
    try { const data = await response.json(); message = data.message || message; } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  return response.blob();
}

export async function saveShowcase(boothId, showcase) {
  const response = await apiRequest(`/api/booths/${boothId}/showcase`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tagline: showcase.tagline,
      offer: showcase.offer,
      hours: showcase.hours,
      products: showcase.products,
      staff: showcase.staff.map(({ name, role, email }) => ({
        name,
        role,
        email,
      })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to save booth showcase.');
  }

  return data.booth;
}


let viewed = new Set();
export function trackBoothView(boothId) {
  if (viewed.has(boothId)) return;
  viewed.add(boothId);
  mutate((s) => {
    const b = s.booths.find((x) => x.id === boothId);
    if (b) b.visits = (b.visits || 0) + 1;
  });
}

/* ---------------- Applications ---------------- */
export function applyToExpo(p) {
  const d = getState();
  if (d.applications.some((a) => a.expoId === p.expoId && a.exhibitorId === p.exhibitorId && a.status !== 'rejected' && a.status !== 'withdrawn'))
    throw new Error('You already have an active application for this expo.');
  if (!p.company?.trim() || !p.products?.trim()) throw new Error('Company name and products/services are required.');
  if (!p.documents?.length) throw new Error('Please attach at least one supporting document.');
  mutate((s) => {
    const expo = s.expos.find((e) => e.id === p.expoId);
    s.applications.push({
      id: uid('app'), status: 'pending', note: '', boothId: null, createdAt: new Date().toISOString(), decidedAt: null, ...p,
    });
    admins(s).forEach((a) => pushNote(s, a.id, 'New exhibitor application', `${p.company} applied for ${expo.title}.`, 'info', '/dashboard/applications'));
    pushActivity(s, `${p.company} applied for ${expo.title}`);
  });
}

export function decideApplication(appId, status, note = '', boothId = null) {
  mutate((s) => {
    const a = s.applications.find((x) => x.id === appId);
    const expo = s.expos.find((e) => e.id === a.expoId);
    a.status = status;
    a.note = note;
    a.decidedAt = new Date().toISOString();
    if (status === 'approved') {
      pushNote(s, a.exhibitorId, 'Application approved 🎉', `Your application for ${expo.title} was approved. ${boothId ? 'A booth has been assigned.' : 'Pick your booth now.'}`, 'success', '/dashboard/booth');
      if (boothId) {
        const b = s.booths.find((x) => x.id === boothId);
        if (b && b.status === 'available') {
          Object.assign(b, { status: 'booked', exhibitorId: a.exhibitorId, appId: a.id });
          a.boothId = b.id;
        }
      }
    } else if (status === 'rejected') {
      pushNote(s, a.exhibitorId, 'Application update', `Your application for ${expo.title} was not approved.${note ? ' Reason: ' + note : ''}`, 'warning', '/dashboard/applications');
      // release any held booth
      s.booths.filter((b) => b.appId === a.id).forEach((b) => Object.assign(b, { status: 'available', exhibitorId: null, appId: null, showcase: null }));
      a.boothId = null;
    }
    pushActivity(s, `${a.company} application ${status} for ${expo.title}`);
  });
}

export function withdrawApplication(appId) {
  mutate((s) => {
    const a = s.applications.find((x) => x.id === appId);
    s.booths.filter((b) => b.appId === appId).forEach((b) => Object.assign(b, { status: 'available', exhibitorId: null, appId: null, showcase: null }));
    s.applications = s.applications.filter((x) => x.id !== appId);
    pushActivity(s, `${a.company} withdrew an application`);
  });
}

/** type: 'register' | 'bookmark'. Toggles; returns the new state (true = on). */
export function toggleSession(sessionId, userId, type) {
  return mutate((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    const existing = s.sessionRegs.find((r) => r.sessionId === sessionId && r.userId === userId && r.type === type);
    if (existing) {
      s.sessionRegs = s.sessionRegs.filter((r) => r.id !== existing.id);
      return false;
    }
    if (type === 'register') {
      const taken = s.sessionRegs.filter((r) => r.sessionId === sessionId && r.type === 'register').length + Math.round((sess.interest || 0) / 4);
      if (taken >= sess.capacity) throw new Error('This session is full.');
      if (!s.registrations.some((r) => r.expoId === sess.expoId && r.userId === userId)) {
        s.registrations.push({ id: uid('reg'), expoId: sess.expoId, userId, ticket: 'Standard', createdAt: new Date().toISOString() });
      }
      s.sessionRegs = s.sessionRegs.filter((r) => !(r.sessionId === sessionId && r.userId === userId && r.type === 'bookmark'));
    }
    s.sessionRegs.push({ id: uid('sr'), sessionId, userId, type, createdAt: new Date().toISOString() });
    if (type === 'bookmark') pushNote(s, userId, 'Reminder set', `We'll remind you before “${sess.title}” starts.`, 'reminder', '/dashboard/agenda');
    return true;
  });
}

/* ---------------- Backend Messages ---------------- */

export async function getMessageContacts() {
  const response = await apiRequest('/api/messages/contacts');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load contacts.');
  }

  return data.contacts;
}

const normalizeMessage = (message) => ({
  ...message,
  id: message?._id || message?.id,
  from: message?.from?._id || message?.from?.id || message?.from,
  to: message?.to?._id || message?.to?.id || message?.to,
});

export async function getMyConversations() {
  const response = await apiRequest('/api/messages/conversations');
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load conversations.');
  return (data.conversations || []).map((conversation) => ({
    ...conversation,
    last: conversation.last ? normalizeMessage(conversation.last) : null,
    other: String(conversation.other),
    user: conversation.user ? { ...conversation.user, id: conversation.user._id || conversation.user.id } : null,
  }));
}

export async function getConversation(userId) {
  const response = await apiRequest(`/api/messages/conversation/${userId}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load conversation.');
  return (data.messages || []).map(normalizeMessage);
}

export async function sendMessage({ to, text, kind = 'text', meta = {} }) {
  const response = await apiRequest('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, text, kind, meta }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to send message.');
  }

  return normalizeMessage(data.data);
}

export async function deleteMessageApi(messageId, scope = 'me') {
  const response = await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to delete message.');
  return data;
}

export async function clearConversationMessagesApi(userId) {
  const response = await apiRequest(`/api/messages/conversation/${userId}/messages`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to clear conversation.');
  return data;
}

export async function hideConversationApi(userId) {
  const response = await apiRequest(`/api/messages/conversation/${userId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to remove chat.');
  return data;
}

export async function markThreadRead(userId) {
  const response = await apiRequest(`/api/messages/conversation/${userId}/read`, {
    method: 'PATCH',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to mark conversation as read.');
  }

  return data;
}


/* ---------------- Notifications ---------------- */
/* ---------------- Backend Feedback ---------------- */

export async function submitFeedback(feedback) {
  const response = await apiRequest('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(feedback),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to submit feedback.');
  }

  return data;
}

export async function getMyFeedback() {
  const response = await apiRequest('/api/feedback/my');

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load your feedback.');
  }

  return data;
}

export async function getAllFeedback(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query
    ? `/api/feedback?${query}`
    : '/api/feedback';

  const response = await apiRequest(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load feedback.');
  }

  return data;
}

export async function updateFeedback(id, patch) {
  const response = await apiRequest(`/api/feedback/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to update feedback.');
  }

  return data;
}



export const today = ymd;

/* ---------------- Backend Notifications ---------------- */

export async function getMyNotifications() {
  const response = await apiRequest('/api/notifications');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load notifications.');
  }

  return data;
}

export async function markNotificationAsRead(id) {
  const response = await apiRequest(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to mark notification as read.');
  }

  return data;
}

export async function markAllNotificationsRead() {
  const response = await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to mark notifications as read.');
  return data;
}



export async function getChatbotStatus() {
  const response = await apiRequest('/api/chatbot/status');
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to check assistant availability.');
  return { status: ['unconfigured', 'ready', 'available', 'unavailable'].includes(data.status) ? data.status : 'unknown' };
}

export async function sendChatbotMessage(message, history = []) {
  const response = await apiRequest('/api/chatbot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to get chatbot response.');
  }

  return data;
}



export async function getDashboardAnalytics() {
  const response = await apiRequest('/api/analytics/dashboard');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load dashboard analytics.');
  }

  return data;
}

export async function getExpoAnalytics() {
  const response = await apiRequest('/api/analytics/expos');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load expo analytics.');
  }

  return data;
}

export async function getAdminActivities(limit = 8) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 50);
  const response = await apiRequest(`/api/admin/activity?limit=${safeLimit}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load admin activity.');
  }

  return data.activities || [];
}

export async function downloadExpoAnalyticsPdf(expoId) {
  const response = await apiRequest(`/api/analytics/expos/${encodeURIComponent(expoId)}/report.pdf`);
  if (!response.ok) {
    let message = 'Unable to export the Expo analytics PDF.';
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the safe fallback when the server returns a non-JSON error.
    }
    throw new Error(message);
  }
  return response.blob();
}



export async function getExpoStats(expoId) {
  const response = await apiRequest(`/api/expos/${expoId}/stats`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch Expo stats.');
  }

  return data.stats;
}


/* ---------------- Admin user management APIs ---------------- */

export async function getAdminUsersApi({ page = 1, limit = 20, search = '', role = '', status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const response = await apiRequest(`/api/admin/users?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to load users.');
  return data;
}

export async function updateAdminUserStatusApi(userId, status) {
  const response = await apiRequest(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to update user status.');
  return data.user;
}

export async function updateAdminUserRoleApi(userId, role) {
  const response = await apiRequest(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to update user role.');
  return data.user;
}

export async function deleteAdminUserApi(userId) {
  const response = await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Unable to delete user.');
  return data;
}
