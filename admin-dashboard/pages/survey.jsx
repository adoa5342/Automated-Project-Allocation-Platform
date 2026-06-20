import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentSurvey from '../components/StudentSurvey'

const queryClient = new QueryClient();

export default function Survey() {
  return (
    <QueryClientProvider client={queryClient}>
      <StudentSurvey />
    </QueryClientProvider>
  );
}