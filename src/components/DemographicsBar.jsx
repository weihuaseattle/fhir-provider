import React from 'react';

const DemographicsBar = ({ patient }) => {
  if (!patient) {
    return null;
  }

  // Extract patient data for display
  const firstName = patient?.name?.[0]?.given?.join(' ') || 'N/A';
  const lastName = patient?.name?.[0]?.family || 'N/A';
  const birthDate = patient?.birthDate || 'N/A';
  const gender = patient?.gender || 'N/A';
  const age = birthDate !== 'N/A' ? calculateAge(birthDate) : 'N/A';
  const mrn = patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || 'N/A';

  function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  return (
    <div className="demographics-bar">
      <div className="demographics-content">
        <div className="demographics-item">
          <span className="demographics-label">Name:</span>
          <span className="demographics-value">{firstName} {lastName}</span>
        </div>
        <div className="demographics-item">
          <span className="demographics-label">MRN:</span>
          <span className="demographics-value">{mrn}</span>
        </div>
        <div className="demographics-item">
          <span className="demographics-label">Age:</span>
          <span className="demographics-value">{age} years</span>
        </div>
        <div className="demographics-item">
          <span className="demographics-label">Gender:</span>
          <span className="demographics-value">{gender}</span>
        </div>
        <div className="demographics-item">
          <span className="demographics-label">DOB:</span>
          <span className="demographics-value">{birthDate}</span>
        </div>
      </div>
    </div>
  );
};

export default DemographicsBar; 