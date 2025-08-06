import React, { useState, useEffect } from 'react';
import { updateObservation, createObservation } from '../utils/fhir';

const ObservationCategory = ({ category, observations, fhirBaseUrl, accessToken, patientId, encounterId, onUpdate, onReset }) => {
  const [editingObservations, setEditingObservations] = useState({});
  const [newObservation, setNewObservation] = useState({
    code: '',
    codeText: '',
    value: '',
    unit: '',
    status: 'final'
  });
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');

  // Reset form when onReset is called
  useEffect(() => {
    if (onReset) {
      // Clear the new observation form
      setNewObservation({
        code: '',
        codeText: '',
        value: '',
        unit: '',
        status: 'final'
      });
      // Clear any editing states
      setEditingObservations({});
      // Clear any error messages
      setError('');
    }
  }, [onReset]);

  const handleObservationChange = (observationId, field, value) => {
    setEditingObservations(prev => ({
      ...prev,
      [observationId]: {
        ...prev[observationId],
        [field]: value
      }
    }));
  };

  const handleNewObservationChange = (field, value) => {
    setNewObservation(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdateObservation = async (observation) => {
    const observationId = observation.id;
    setLoading(prev => ({ ...prev, [observationId]: true }));
    setError('');

    try {
      const changes = editingObservations[observationId];
      console.log('Changes to apply:', changes);
      
             // Parse the value to extract numeric value and unit
       const parseValueAndUnit = (valueStr) => {
         if (!valueStr) return { value: null, unit: '' };
         
         // Try to match patterns like "37.3 degC", "70 kg", "120 mmHg"
         const match = valueStr.match(/^([\d.]+)\s*(.+)$/);
         if (match) {
           let unit = match[2].trim();
           
           // Normalize common temperature units to UCUM codes
           const unitMap = {
             'degC': 'Cel',
             '°C': 'Cel',
             'celsius': 'Cel',
             'C': 'Cel',
             'degF': '[degF]',
             '°F': '[degF]',
             'fahrenheit': '[degF]',
             'F': '[degF]'
           };
           
           unit = unitMap[unit] || unit;
           
           return {
             value: parseFloat(match[1]),
             unit: unit
           };
         }
         
         // If no unit found, try to parse as just a number
         const numericValue = parseFloat(valueStr);
         return {
           value: isNaN(numericValue) ? null : numericValue,
           unit: ''
         };
       };

       const parsedValue = parseValueAndUnit(changes.value);
       
             // Build the updated observation data (partial update - will be merged with existing observation)
      const updatedObservation = {};
      
      // Only include fields that are actually changing
      if (changes.status && changes.status !== observation.status) {
        updatedObservation.status = changes.status;
      }
      
      if (changes.code || changes.codeText) {
        updatedObservation.code = {
          coding: [{
            system: 'http://loinc.org',
            code: changes.code || observation.code?.coding?.[0]?.code,
            display: changes.codeText || observation.code?.coding?.[0]?.display
          }],
          text: changes.codeText || observation.code?.text
        };
      }
      
      if (changes.value && parsedValue.value !== null) {
        // Preserve all original valueQuantity properties and only update the value
        updatedObservation.valueQuantity = {
          ...observation.valueQuantity,
          value: parsedValue.value
        };
        
        // Ensure required fields are present for FHIR validation
        if (!updatedObservation.valueQuantity.system) {
          updatedObservation.valueQuantity.system = "http://unitsofmeasure.org";
        }
        
        // For temperature observations, ensure proper UCUM codes
        if (parsedValue.unit === 'degC' || observation.valueQuantity?.unit === 'degC') {
          updatedObservation.valueQuantity.unit = 'Cel';
          updatedObservation.valueQuantity.code = 'Cel';
        } else if (parsedValue.unit === 'degF' || observation.valueQuantity?.unit === 'degF') {
          updatedObservation.valueQuantity.unit = '[degF]';
          updatedObservation.valueQuantity.code = '[degF]';
        }
        
        // Ensure code field is present (required by FHIR)
        if (!updatedObservation.valueQuantity.code && updatedObservation.valueQuantity.unit) {
          updatedObservation.valueQuantity.code = updatedObservation.valueQuantity.unit;
        }
        
        // If observation status is 'final', change to 'corrected' to allow updates
        if (observation.status === 'final') {
          updatedObservation.status = 'corrected';
        }
      }

      console.log('Sending update with data:', updatedObservation);
      await updateObservation(fhirBaseUrl, observationId, updatedObservation, accessToken, onUpdate);
      
      setEditingObservations(prev => {
        const newState = { ...prev };
        delete newState[observationId];
        return newState;
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(`Failed to update observation: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [observationId]: false }));
    }
  };

  const handleCreateObservation = async () => {
    setLoading(prev => ({ ...prev, new: true }));
    setError('');

    try {
      const observationData = {
        resourceType: 'Observation',
        status: newObservation.status,
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: category
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: newObservation.code,
            display: newObservation.codeText || newObservation.code
          }],
          text: newObservation.codeText || newObservation.code
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        encounter: encounterId ? {
          reference: `Encounter/${encounterId}`
        } : undefined,
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: {
          value: parseFloat(newObservation.value),
          unit: newObservation.unit,
          system: "http://unitsofmeasure.org",
          code: newObservation.unit === 'degC' ? 'Cel' : (newObservation.unit === 'degF' ? '[degF]' : newObservation.unit)
        }
      };

      await createObservation(fhirBaseUrl, observationData, accessToken, onUpdate);
      setNewObservation({
        code: '',
        codeText: '',
        value: '',
        unit: '',
        status: 'final'
      });
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(`Failed to create observation: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, new: false }));
    }
  };

  const getObservationValue = (observation) => {
    if (observation.valueQuantity) {
      return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
    }
    if (observation.valueCodeableConcept) {
      return observation.valueCodeableConcept.coding?.[0]?.display || '';
    }
    return 'N/A';
  };

  return (
    <div className="observation-category">
      <h3>{category}</h3>
      {error && <div className="error">{error}</div>}
      
      {observations.map(observation => (
        <div key={observation.id} className="observation-item">
          <h4>Observation ID: {observation.id}</h4>
          <div className="form-group">
            <label>Code:</label>
            <input
              type="text"
              value={editingObservations[observation.id]?.code || observation.code?.coding?.[0]?.code || ''}
              onChange={(e) => handleObservationChange(observation.id, 'code', e.target.value)}
              disabled={!editingObservations[observation.id]}
            />
          </div>
          <div className="form-group">
            <label>Code Text:</label>
            <input
              type="text"
              value={editingObservations[observation.id]?.codeText || observation.code?.text || ''}
              onChange={(e) => handleObservationChange(observation.id, 'codeText', e.target.value)}
              disabled={!editingObservations[observation.id]}
            />
          </div>
          <div className="form-group">
            <label>Value:</label>
            <input
              type="text"
              value={editingObservations[observation.id]?.value || getObservationValue(observation)}
              onChange={(e) => handleObservationChange(observation.id, 'value', e.target.value)}
              disabled={!editingObservations[observation.id]}
            />
          </div>
          <div className="form-group">
            <label>Status:</label>
            <select
              value={editingObservations[observation.id]?.status || observation.status || 'final'}
              onChange={(e) => handleObservationChange(observation.id, 'status', e.target.value)}
              disabled={!editingObservations[observation.id]}
            >
              <option value="registered">Registered</option>
              <option value="preliminary">Preliminary</option>
              <option value="final">Final</option>
              <option value="amended">Amended</option>
              <option value="corrected">Corrected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label>Effective Date/Time:</label>
            <input
              type="text"
              value={observation.effectiveDateTime ? new Date(observation.effectiveDateTime).toLocaleString() : 'N/A'}
              disabled={true}
              style={{ backgroundColor: '#f5f5f5', color: '#666' }}
            />
          </div>
          
          <div style={{ marginTop: '10px' }}>
            {!editingObservations[observation.id] ? (
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => setEditingObservations(prev => ({ ...prev, [observation.id]: {} }))}
              >
                Edit Observation
              </button>
            ) : (
              <div>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={() => handleUpdateObservation(observation)}
                  disabled={loading[observation.id]}
                >
                  {loading[observation.id] ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingObservations(prev => {
                    const newState = { ...prev };
                    delete newState[observation.id];
                    return newState;
                  })}
                  style={{ marginLeft: '10px' }}
                  disabled={loading[observation.id]}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="new-observation">
        <h4>Add New Observation</h4>
        <div className="form-group">
          <label>Code:</label>
          <input
            type="text"
            value={newObservation.code}
            onChange={(e) => handleNewObservationChange('code', e.target.value)}
            placeholder="e.g., 8302-2"
          />
        </div>
        <div className="form-group">
          <label>Code Text:</label>
          <input
            type="text"
            value={newObservation.codeText || ''}
            onChange={(e) => handleNewObservationChange('codeText', e.target.value)}
            placeholder="e.g., Body Height"
          />
        </div>
        <div className="form-group">
          <label>Value:</label>
          <input
            type="text"
            value={newObservation.value}
            onChange={(e) => handleNewObservationChange('value', e.target.value)}
            placeholder="e.g., 70"
          />
        </div>
        <div className="form-group">
          <label>Unit:</label>
          <input
            type="text"
            value={newObservation.unit}
            onChange={(e) => handleNewObservationChange('unit', e.target.value)}
            placeholder="e.g., kg"
          />
        </div>
        <div className="form-group">
          <label>Status:</label>
          <select
            value={newObservation.status}
            onChange={(e) => handleNewObservationChange('status', e.target.value)}
          >
            <option value="registered">Registered</option>
            <option value="preliminary">Preliminary</option>
            <option value="final">Final</option>
            <option value="amended">Amended</option>
            <option value="corrected">Corrected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button 
          type="button" 
          className="btn-success"
          onClick={handleCreateObservation}
          disabled={loading.new || !newObservation.code || !newObservation.value}
        >
          {loading.new ? 'Adding...' : 'Add New Observation'}
        </button>
      </div>
    </div>
  );
};

export default ObservationCategory; 