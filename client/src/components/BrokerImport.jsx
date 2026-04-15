import { useState } from 'react';
import useStore from '../store/useStore';
import { UploadCloud, Info } from 'lucide-react';

import * as api from '../api/portfolioApi';

// Reusable Tooltip 
const Tooltip = ({ children }) => (
  <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block', marginLeft: '8px', cursor: 'pointer' }}>
    <Info size={16} color="var(--text-muted)" />
    <div className="tooltip-text" style={{
      visibility: 'hidden',
      width: '280px',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      textAlign: 'left',
      borderRadius: '6px',
      padding: '10px',
      position: 'absolute',
      zIndex: 50,
      bottom: '125%',
      left: '50%',
      marginLeft: '-140px',
      boxShadow: 'var(--shadow-lg)',
      border: '1px solid var(--border-color)',
      fontSize: '0.8rem',
      lineHeight: '1.4'
    }}>
      {children}
    </div>
  </div>
);

const BrokerImport = () => {
  const { fetchPortfolio } = useStore();
  const [broker, setBroker] = useState('zerodha');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) return;

    setStatus('Uploading...');

    try {
      const data = await api.importBrokerFile(broker, file);
      setStatus(`Successfully imported ${data.count} records!`);
      fetchPortfolio(); // refresh data
      setFile(null);
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ height: '100%' }}>
      <h3>Import from Broker</h3>
      <p style={{ fontSize: '0.875rem', marginBottom: '20px' }}>Upload your exact holding statement to sync your portfolio.</p>
      
      <form onSubmit={handleImport}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            Select Broker
            {broker === 'zerodha' && (
              <Tooltip>
                <strong>Zerodha Instructions:</strong><br/>
                1. Login to Zerodha Console.<br/>
                2. Go to Portfolio -{'>'} Holdings.<br/>
                3. Click the "Download" button to get the XLSX file.<br/>
                4. Upload that .XLSX or .CSV file here.
              </Tooltip>
            )}
            {broker === 'groww' && (
              <Tooltip>
                 <strong>Groww Instructions:</strong><br/>
                 1. Login to Groww website.<br/>
                 2. Go to your Profile -{'>'} Reports.<br/>
                 3. Download the Holding Statement in Excel format.<br/>
                 4. Upload the .XLSX or .CSV here.
              </Tooltip>
            )}
          </label>
          <select value={broker} onChange={(e) => setBroker(e.target.value)}>
            <option value="zerodha">Zerodha</option>
            <option value="groww">Groww</option>
          </select>
        </div>

        <div style={{ 
            border: '2px dashed var(--border-color)', 
            borderRadius: 'var(--radius-md)', 
            padding: '20px', 
            textAlign: 'center',
            marginBottom: '15px',
            backgroundColor: 'rgba(0,0,0,0.2)'
         }}>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              onChange={(e) => setFile(e.target.files[0])} 
              style={{ display: 'none' }} 
              id="file-upload" 
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <UploadCloud size={32} color="var(--accent-primary)" style={{ marginBottom: '10px' }} />
                <span>{file ? file.name : "Click to select XLSX / CSV file"}</span>
            </label>
        </div>

        <button type="submit" className="btn-secondary" style={{ width: '100%' }} disabled={!file}>
            Run Import
        </button>
        {status && <div style={{ marginTop: '10px', fontSize: '0.875rem', textAlign: 'center' }}>{status}</div>}
      </form>
    </div>
  );
};

export default BrokerImport;
