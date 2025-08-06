# SMART FHIR Provider for Cerner

A React-based SMART FHIR provider application designed to integrate with Cerner's FHIR server. This application implements the SMART on FHIR launch sequence and provides a comprehensive interface for viewing and editing patient data and observations.

## Features

- **SMART on FHIR Launch**: Implements the complete SMART launch sequence with PKCE
- **Patient Management**: View and edit patient details
- **Observation Management**: View, edit, and create patient observations organized by category
- **Real-time Updates**: Refresh data and see changes immediately
- **Modern UI**: Clean, responsive interface with proper error handling

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fhir-provider
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` or `http://127.0.0.1:5173`.

## Usage

### Local Development

When running locally, the app displays a welcome message at `http://localhost:5173` or `http://127.0.0.1:5173`.

### Cerner Integration

The app is designed to be launched by Cerner's Test Environment with the following URL pattern:

```
http://localhost:5173/?iss={Cerner_FHIR_Server_URL}&launch={launch_context_code}
```

Example:
```
http://127.0.0.1:5173/?iss=https%3A%2F%2Ffhir-ehr-code.cerner.com%2Fr4%2Fec2458f2-1e24-41c8-b71b-0e701af7583d&launch=d1b21743-45ca-4a43-86f1-badcdae1c38f
```

### OAuth2 Configuration

The app uses the following OAuth2 configuration:

- **Client ID**: `36b8595f-9eb7-416e-ae7e-9135473eb3cd`
- **Grant Type**: Authorization Code with PKCE
- **Code Challenge Method**: SHA-256
- **Scope**: `openid fhirUser launch offline_access user/Patient.crus user/Observation.crus`
- **Redirect URI**: `http://localhost:5173` or `http://127.0.0.1:5173`
- **State**: `12345678`

## Application Flow

1. **Initial Launch**: App displays welcome message
2. **SMART Launch**: When launched with `iss` and `launch` parameters:
   - Displays "Authorizing to Cerner..." message
   - Fetches SMART configuration from Cerner's FHIR server
   - Generates PKCE code challenge
   - Opens popup for OAuth authorization
3. **Authorization**: User completes OAuth flow in popup
4. **Token Exchange**: App exchanges authorization code for access token
5. **Data Retrieval**: Fetches patient details and observations
6. **Interface Display**: Shows editable patient details and observation categories

## Features

### Patient Details
- View patient information in editable form fields
- Edit patient details (name, birth date, gender, address, contact info)
- Save changes back to Cerner's FHIR server

### Observations
- View observations organized by category
- Edit existing observations (code, value, status)
- Add new observations to any category
- Real-time updates with refresh functionality

## API Endpoints Used

- `GET /.well-known/smart-configuration` - Get SMART configuration
- `POST {token_endpoint}` - Exchange authorization code for token
- `GET /Patient/{id}` - Get patient details
- `PUT /Patient/{id}` - Update patient details
- `GET /Observation?patient={id}` - Get patient observations
- `PUT /Observation/{id}` - Update observation
- `POST /Observation` - Create new observation

## Error Handling

The application includes comprehensive error handling for:
- Network connectivity issues
- Authorization failures
- Invalid SMART launch parameters
- FHIR server errors
- Data validation errors

## Development

### Project Structure

```
src/
├── components/
│   ├── PatientDetails.jsx
│   └── ObservationCategory.jsx
├── utils/
│   └── fhir.js
├── App.jsx
├── main.jsx
└── index.css
```

### Key Components

- **App.jsx**: Main application component handling SMART launch flow
- **PatientDetails.jsx**: Component for viewing and editing patient information
- **ObservationCategory.jsx**: Component for managing observations by category
- **fhir.js**: Utility functions for FHIR operations and OAuth2 flow

## Building for Production

```bash
npm run build
```

This creates a production build in the `dist` directory.

## Testing

The application can be tested with Cerner's Test Environment by:

1. Starting the development server
2. Configuring Cerner Test Environment to launch the app
3. Using the provided client ID and redirect URI
4. Testing the complete SMART launch flow

## Security Considerations

- Uses PKCE for secure OAuth2 flow
- Validates state parameter to prevent CSRF attacks
- Implements proper error handling for security-related issues
- Uses HTTPS for all FHIR server communications

## Troubleshooting

### Common Issues

1. **Popup Blocked**: Ensure popup blockers are disabled for localhost
2. **CORS Issues**: The app is designed to run on localhost:5173 or 127.0.0.1:5173
3. **Authorization Errors**: Verify the client ID and redirect URI match Cerner's configuration
4. **Network Errors**: Check connectivity to Cerner's FHIR server

### Debug Mode

Enable browser developer tools to see detailed error messages and network requests.

## License

This project is licensed under the MIT License.