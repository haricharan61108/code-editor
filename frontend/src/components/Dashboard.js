import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [jobId, setJobId] = useState('');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setLoading(true);
    setOutput('');
    try {
      const response = await axios.post(
        'http://localhost:3000/submit',
        { code, input },
        {
          headers: {
            Authorization: token,
          },
        }
      );
      setJobId(response.data.jobId);
      setError('');
      const checkResult = async () => {
        try {
          const result = await axios.get(`http://localhost:3000/result/${response.data.jobId}`);
          if (result.data.stdout || result.data.stderr) {
            setOutput(result.data.stdout || result.data.stderr);
            setLoading(false);
          } else {
            setTimeout(checkResult, 1000);
          }
        } catch (err) {
          console.error('Error fetching result:', err);
          setLoading(false);
        }
      };
      checkResult();
    } catch (error) {
      setLoading(false);
      setError(error.response.data.error);
    }
  };

  return (
    <div className="Dashboard" style={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
      <div style={{ width: '50%', padding: '20px' }}>
        <h2>Write your C++ Code</h2>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows="20"
          style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '16px' }}
        />
        <h3>Input</h3>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows="5"
          style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '16px' }}
        />
        <button
          onClick={handleSubmit}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Running...' : 'Run Code'}
        </button>
        {error && <p>{error}</p>}
      </div>
      <div style={{ width: '50%', padding: '20px', borderLeft: '1px solid #ccc' }}>
        <h2>Output</h2>
        {loading ? (
          <p>Waiting for output...</p>
        ) : (
          <pre style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '5px' }}>
            {output || 'Your output will be displayed here.'}
          </pre>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
