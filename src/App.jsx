import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  generatePKCE, 
  getSmartConfiguration, 
  exchangeCodeForToken, 
  getPatientDetails, 
  getPatientObservations,
  groupObservationsByCategory 
} from './utils/fhir';
import PatientDetails from './components/PatientDetails';
import ObservationCategory from './components/ObservationCategory';

let bRunOnce = false
function App() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('initial');
  const [error, setError] = useState('');
  const [fhirBaseUrl, setFhirBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [patient, setPatient] = useState(null);
  const [observations, setObservations] = useState({});
  const [loading, setLoading] = useState(false);
  const [launchProcessed, setlaunchProcessed] = useState(false);
  const [callbackProcessed, setCallbackProcessed] = useState(false);

  useEffect(() => {
    const iss = searchParams.get('iss');
    const launch = searchParams.get('launch');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Only start SMART launch if we have iss/launch but NOT callback parameters
    if (iss && launch && !code && !state && !launchProcessed) {
      console.log('000000');
      setlaunchProcessed(true);
      handleSmartLaunch(iss, launch);
    }
    if (code && state && !callbackProcessed && !bRunOnce) {
      console.log('111111');
      bRunOnce = true;
      setCallbackProcessed(true);
      handleAuthorizationCallback(code, state);
    }
  }, [searchParams]);

        
  const handleSmartLaunch = async (iss, launch) => {
    setStatus('authorizing');
    setError('');

    try {
      // Step 1: Get SMART configuration
      const smartConfig = await getSmartConfiguration(iss);
      const { authorization_endpoint, token_endpoint } = smartConfig;

      // Step 2: Generate PKCE
      const { codeVerifier, codeChallenge } = generatePKCE();

             // Step 3: Construct authorization URL
       const authUrl = new URL(authorization_endpoint);
       authUrl.searchParams.set('aud', iss);
       authUrl.searchParams.set('launch', launch);
       authUrl.searchParams.set('response_type', 'code');
       authUrl.searchParams.set('client_id', '36b8595f-9eb7-416e-ae7e-9135473eb3cd');
       authUrl.searchParams.set('code_challenge', codeChallenge);
       authUrl.searchParams.set('code_challenge_method', 'S256');
       authUrl.searchParams.set('scope', 'openid fhirUser launch offline_access user/Patient.crus user/Observation.crus');
       authUrl.searchParams.set('redirect_uri', "http://127.0.0.1:5173");
       authUrl.searchParams.set('state', '12345678');

       console.log('Authorization URL parameters:', {
         authorization_endpoint,
         aud: iss,
         launch,
         response_type: 'code',
         client_id: '36b8595f-9eb7-416e-ae7e-9135473eb3cd',
         code_challenge: codeChallenge,
         code_challenge_method: 'S256',
         scope: 'openid fhirUser launch offline_access user/Patient.crus user/Observation.crus',
         redirect_uri: "http://127.0.0.1:5173",
         state: '12345678'
       });

             // Step 4: Redirect current window to authorization URL
       console.log('Redirecting to authorization URL:', authUrl.toString());
       
       // Store PKCE code verifier in sessionStorage for when we return
       sessionStorage.setItem('smart_code_verifier', codeVerifier);
       sessionStorage.setItem('smart_token_endpoint', token_endpoint);
       sessionStorage.setItem('smart_iss', iss);
       
       // Redirect the current window to the authorization URL
       window.location.href = authUrl.toString();

    } catch (err) {
      setError('1111 Failed to start authorization: ' + err.message);
      setStatus('error');
    }
  };

  const handleRefreshData = async () => {
    if (!fhirBaseUrl || !accessToken || !patient) return;

    // Clear any existing error messages
    setError('');
    
    setLoading(true);
    try {
      console.log('444444');
      const observationsData = await getPatientObservations(fhirBaseUrl, patient.id, accessToken, handleTokenRefresh);
      console.log('Observations data structure:', observationsData);
      const observations = observationsData.entry?.map(entry => entry.resource) || [];
      console.log('Extracted observations:', observations);
      const groupedObservations = groupObservationsByCategory(observations);
      setObservations(groupedObservations);
      
      // Trigger form reset in all ObservationCategory components
      handleResetObservationForms();
    } catch (err) {
      setError('Failed to refresh observations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleDirectRedirect = () => {
    // This function is now the same as handleSmartLaunch since we're using the main window
    const iss = searchParams.get('iss');
    const launch = searchParams.get('launch');
    
    if (iss && launch) {
      handleSmartLaunch(iss, launch);
    }
  };

  const handleTokenRefresh = (newAccessToken) => {
    console.log('Token refreshed, updating access token');
    setAccessToken(newAccessToken);
  };

  // Function to reset observation forms (called when refreshing data)
  const handleResetObservationForms = () => {
    // This will be called by ObservationCategory components to reset their forms
    console.log('Resetting observation forms');
  };


  const handleAuthorizationCallback = async (code, state) => {
    console.log('Authorization callback received:', { code, state });
    
    if (state !== '12345678') {
      setError('Invalid state parameter');
      return;
    }

    try {
      // Retrieve stored values from sessionStorage
      const codeVerifier = sessionStorage.getItem('smart_code_verifier');
      const tokenEndpoint = sessionStorage.getItem('smart_token_endpoint');
      const iss = sessionStorage.getItem('smart_iss');

      console.log('Retrieved from sessionStorage:', {
        codeVerifier: codeVerifier ? '***' : 'undefined',
        tokenEndpoint,
        iss
      });

      if (!codeVerifier || !tokenEndpoint || !iss) {
        setError('Missing authorization context. Please try again.');
        return;
      }

      // Step 6: Exchange code for token
      const tokenResponse = await exchangeCodeForToken(
          tokenEndpoint,
          code,
          codeVerifier,
          "http://127.0.0.1:5173"
        );

      setAccessToken(tokenResponse.access_token);
      setFhirBaseUrl(iss);

      // Step 7: Get patient details and store encounter info
      const patientId = tokenResponse.patient;
      const encounterId = tokenResponse.encounter;
      
      // Store encounter ID for use in observations
      if (encounterId) {
        sessionStorage.setItem('smart_encounter_id', encounterId);
      }
      const patientData = await getPatientDetails(iss, patientId, tokenResponse.access_token, handleTokenRefresh);
      setPatient(patientData);

             // Step 8: Get patient observations
       console.log('333333');
       const observationsData = await getPatientObservations(iss, patientId, tokenResponse.access_token, handleTokenRefresh);
       console.log('Initial observations data:', observationsData);
       const observations = observationsData.entry?.map(entry => entry.resource) || [];
       console.log('Extracted observations for grouping:', observations);
       const groupedObservations = groupObservationsByCategory(observations);
      setObservations(groupedObservations);

      setStatus('authorized');

      // Clean up temporary sessionStorage items (keep token_endpoint for refresh)
      sessionStorage.removeItem('smart_code_verifier');
      sessionStorage.removeItem('smart_iss');

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

    } catch (err) {
      setError('22222 Failed to complete authorization: ' + err.message);
      setStatus('error');
    }
  };

  if (status === 'initial') {
    return (
      <div className="container">
        <h1>Welcome to SMART FHIR provider app for Cerner</h1>
        <p>This app will launch when called with proper SMART launch parameters.</p>
        
        {/* Debug section for testing */}
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Debug Information</h3>
          <p><strong>Current URL:</strong> {window.location.href}</p>
          <p><strong>ISS Parameter:</strong> {searchParams.get('iss') || 'Not found'}</p>
          <p><strong>Launch Parameter:</strong> {searchParams.get('launch') || 'Not found'}</p>
          <p><strong>Callback code:</strong> {searchParams.get('code') || 'Not found'}</p>
          <p><strong>Callback state:</strong> {searchParams.get('state') || 'Not found'}</p>
          
          {searchParams.get('iss') && searchParams.get('launch') && (
            <button 
              onClick={() => handleSmartLaunch(searchParams.get('iss'), searchParams.get('launch'))}
              className="btn-primary"
              style={{ marginTop: '10px' }}
            >
              Start SMART Authorization
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'authorizing') {
    return (
      <div className="container">
        <div className="loading">
          <h1>Authorizing to Cerner...</h1>
          <p>Redirecting to Cerner for authorization...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container">
        <div className="error">
          <h1>Authorization Error</h1>
          <p>{error}</p>
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => window.location.reload()} style={{ marginRight: '10px' }}>
              Retry Authorization
            </button>
            <button onClick={() => handleDirectRedirect()} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {error && <div className="error">{error}</div>}
      
      {patient && (
        <PatientDetails
          patient={patient}
        />
      )}

      {Object.keys(observations).length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Patient Observations</h2>
            <button 
              onClick={handleRefreshData}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
          
          <div className="observations-container">
            {Object.entries(observations).map(([category, categoryObservations]) => (
              <ObservationCategory
                key={category}
                category={category}
                observations={categoryObservations}
                fhirBaseUrl={fhirBaseUrl}
                accessToken={accessToken}
                patientId={patient?.id}
                encounterId={sessionStorage.getItem('smart_encounter_id')}
                onUpdate={handleRefreshData}
                onReset={handleResetObservationForms}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 