import axios from 'axios';
import CryptoJS from 'crypto-js';

// Generate PKCE code verifier and challenge
export function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = CryptoJS.SHA256(codeVerifier).toString(CryptoJS.enc.Base64url);
  
  console.log('PKCE generated:', {
    codeVerifier: codeVerifier.substring(0, 10) + '...',
    codeChallenge: codeChallenge.substring(0, 10) + '...',
    codeVerifierLength: codeVerifier.length,
    codeChallengeLength: codeChallenge.length
  });
  
  return { codeVerifier, codeChallenge };
}

function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Get SMART configuration from Cerner FHIR server
export async function getSmartConfiguration(fhirBaseUrl) {
  try {
    const response = await axios.get(`${fhirBaseUrl}/.well-known/smart-configuration`);
    return response.data;
  } catch (error) {
    console.error('Error fetching SMART configuration:', error);
    throw error;
  }
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(tokenEndpoint, code, codeVerifier, redirectUri) {
  try {
    console.log('Token exchange parameters:', {
      tokenEndpoint,
      code,
      codeVerifier: codeVerifier ? '***' : 'undefined',
      redirectUri,
      clientId: '36b8595f-9eb7-416e-ae7e-9135473eb3cd'
    });

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: '36b8595f-9eb7-416e-ae7e-9135473eb3cd',
      code_verifier: codeVerifier
    });

    console.log('Token exchange request body:', params.toString());

    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Token exchange response:', response.data);
    
    // Check if we got a valid access token
    if (!response.data.access_token) {
      throw new Error('No access token in response');
    }
    
    // Store refresh token for later use
    if (response.data.refresh_token) {
      sessionStorage.setItem('smart_refresh_token', response.data.refresh_token);
      sessionStorage.setItem('smart_token_endpoint', tokenEndpoint);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Refresh access token using refresh token
export async function refreshAccessToken() {
  try {
    const refreshToken = sessionStorage.getItem('smart_refresh_token');
    const tokenEndpoint = sessionStorage.getItem('smart_token_endpoint');
    
    if (!refreshToken || !tokenEndpoint) {
      throw new Error('No refresh token available');
    }

    console.log('Refreshing access token...');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: '36b8595f-9eb7-416e-ae7e-9135473eb3cd'
    });

    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Token refresh response:', response.data);
    
    if (!response.data.access_token) {
      throw new Error('No access token in refresh response');
    }
    
    // Update stored refresh token if a new one is provided
    if (response.data.refresh_token) {
      sessionStorage.setItem('smart_refresh_token', response.data.refresh_token);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Helper function to make authenticated requests with automatic token refresh
async function makeAuthenticatedRequest(requestFn, accessToken, onTokenRefresh) {
  try {
    return await requestFn(accessToken);
  } catch (error) {
    // Check if the error is due to an expired token (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      console.log('Token expired, attempting to refresh...');
      try {
        const refreshResponse = await refreshAccessToken();
        const newAccessToken = refreshResponse.access_token;
        
        // Notify the app about the new token
        if (onTokenRefresh) {
          onTokenRefresh(newAccessToken);
        }
        
        // Retry the request with the new token
        return await requestFn(newAccessToken);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        throw new Error('Authentication failed - please reauthorize');
      }
    }
    throw error;
  }
}

// Get patient details from FHIR server
export async function getPatientDetails(fhirBaseUrl, patientId, accessToken, onTokenRefresh) {
  return makeAuthenticatedRequest(async (token) => {
    const response = await axios.get(`${fhirBaseUrl}/Patient/${patientId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }, accessToken, onTokenRefresh);
}

// Update patient details
export async function updatePatientDetails(fhirBaseUrl, patientId, patientData, accessToken) {
  try {
    const response = await axios.put(`${fhirBaseUrl}/Patient/${patientId}`, patientData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error updating patient details:', error);
    throw error;
  }
}

// Get patient observations
export async function getPatientObservations(fhirBaseUrl, patientId, accessToken, onTokenRefresh) {
  return makeAuthenticatedRequest(async (token) => {
    const response = await axios.get(`${fhirBaseUrl}/Observation?patient=${patientId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }, accessToken, onTokenRefresh);
}

// Update observation
export async function updateObservation(fhirBaseUrl, observationId, observationData, accessToken, onTokenRefresh) {
  return makeAuthenticatedRequest(async (token) => {
    // First, get the current observation to preserve metadata
    const currentResponse = await axios.get(`${fhirBaseUrl}/Observation/${observationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const currentObservation = currentResponse.data;
    
    // If observationData is a complete observation object, use it directly
    if (observationData.resourceType === 'Observation') {
      // Preserve the original meta and id from the current observation
      const updatedObservation = {
        ...observationData,
        id: currentObservation.id,
        meta: currentObservation.meta
      };
      
      console.log('Using complete observation data:', updatedObservation);
      console.log('Current observation meta:', currentObservation.meta);
      console.log('Updated observation meta:', updatedObservation.meta);
      
      const response = await axios.put(`${fhirBaseUrl}/Observation/${observationId}`, updatedObservation, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'If-Match': `W/"${currentObservation.meta.versionId}"`
        }
      });
      return response.data;
    }
    
    // Otherwise, merge specific fields with the current observation
    const updatedObservation = {
      ...currentObservation,
      // Only update the fields that are provided in observationData
      ...(observationData.status && { status: observationData.status }),
      ...(observationData.code && { code: observationData.code }),
      ...(observationData.valueQuantity && { valueQuantity: observationData.valueQuantity })
      // Don't explicitly override other fields - let the spread operator handle them
    };
    
    // Remove generated narrative text to avoid inconsistencies - server will regenerate it
    if (observationData.valueQuantity && updatedObservation.text?.status === 'generated') {
      delete updatedObservation.text;
    }
    
    console.log('Merging specific fields:', updatedObservation);
    console.log('Current observation meta:', currentObservation.meta);
    console.log('Updated observation meta:', updatedObservation.meta);
    
    // Use PUT for updates since PATCH is not supported
    try {
      const response = await axios.put(`${fhirBaseUrl}/Observation/${observationId}`, updatedObservation, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'If-Match': `W/"${currentObservation.meta.versionId}"`
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 422) {
        console.error('422 Error Details:', error.response.data);
        if (error.response.data.issue) {
          console.error('FHIR Issues:', error.response.data.issue);
        }
        console.error('Request payload:', JSON.stringify(updatedObservation, null, 2));
      }
      throw error;
    }
  }, accessToken, onTokenRefresh);
}

// Create new observation
export async function createObservation(fhirBaseUrl, observationData, accessToken, onTokenRefresh) {
  return makeAuthenticatedRequest(async (token) => {
    const response = await axios.post(`${fhirBaseUrl}/Observation`, observationData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }, accessToken, onTokenRefresh);
}

// Group observations by category
export function groupObservationsByCategory(observations) {
  console.log('groupObservationsByCategory input:', observations);
  const grouped = {};
  
  observations.forEach((observation, index) => {
    console.log(`Processing observation ${index}:`, observation);
    const category = observation.category?.[0]?.coding?.[0]?.display || 'Unknown';
    console.log(`Observation ${index} category:`, category);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(observation);
  });
  
  console.log('Final grouped observations:', grouped);
  return grouped;
} 