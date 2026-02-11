import { DoctorProvider } from './contexts/DoctorContext';
import HistoryView from './components/HistoryView';

export default function HistoryApp() {
  return (
    <DoctorProvider>
      <HistoryView />
    </DoctorProvider>
  );
}
