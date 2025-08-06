import React from 'react';

const PatientDetails = ({ patient }) => {
  if (!patient) {
    return <div className="loading">Loading patient details...</div>;
  }

  // Extract patient data for display
  const firstName = patient?.name?.[0]?.given?.join(' ') || 'N/A';
  const lastName = patient?.name?.[0]?.family || 'N/A';
  const birthDate = patient?.birthDate || 'N/A';
  const gender = patient?.gender || 'N/A';
  const address = patient?.address?.[0]?.text || 'N/A';
  const phone = patient?.telecom?.find(t => t.system === 'phone')?.value || 'N/A';
  const email = patient?.telecom?.find(t => t.system === 'email')?.value || 'N/A';

  return (
    <div className="patient-details">
      <h2>Patient Details</h2>
      
      <div className="form-group">
        <label>First Name:</label>
        <div className="patient-info">{firstName}</div>
      </div>

      <div className="form-group">
        <label>Last Name:</label>
        <div className="patient-info">{lastName}</div>
      </div>

      <div className="form-group">
        <label>Birth Date:</label>
        <div className="patient-info">{birthDate}</div>
      </div>

      <div className="form-group">
        <label>Gender:</label>
        <div className="patient-info">{gender}</div>
      </div>

      <div className="form-group">
        <label>Address:</label>
        <div className="patient-info">{address}</div>
      </div>

      <div className="form-group">
        <label>Phone:</label>
        <div className="patient-info">{phone}</div>
      </div>

      <div className="form-group">
        <label>Email:</label>
        <div className="patient-info">{email}</div>
      </div>
    </div>
  );
};

export default PatientDetails;