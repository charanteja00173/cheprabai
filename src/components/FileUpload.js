import React from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';

const UploadContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: ${({ theme }) => theme.cardBg};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: 10px;
  margin-top: 20px;
  box-shadow: ${({ theme }) => theme.shadow};
`;

const FileUpload = () => {
  const handleFileChange = (e) => {
    console.log(e.target.files[0]);//
  };

  return (
    <UploadContainer
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="neon">Upload File</h2>
      <input type="file" onChange={handleFileChange} />
    </UploadContainer>
  );
};

export default FileUpload;