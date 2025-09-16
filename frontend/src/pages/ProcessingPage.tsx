import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';

export const ProcessingPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const handleComplete = (_results: any) => {
    // Navigate to results page when processing is complete
    navigate(`/results/${jobId}`);
  };

  const handleRetry = (_retryJobId: string) => {
    // For now, just refresh the page to restart polling
    // In a more advanced implementation, this could trigger a new processing job
    window.location.reload();
  };

  if (!jobId) {
    return (
      <Container className="py-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Invalid Job ID
          </h2>
          <p className="text-gray-600">
            No job ID was provided in the URL.
          </p>
          <Button onClick={() => navigate('/')}>
            Return to Upload
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Processing Your Images
          </h1>
          <p className="text-gray-600">
            Please wait while we convert your images to the selected aspect ratio
          </p>
        </div>
        
        <ProcessingStatus
          jobId={jobId}
          onComplete={handleComplete}
          onRetry={handleRetry}
          className="w-full"
        />

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="text-gray-600"
          >
            Start New Upload
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default ProcessingPage;