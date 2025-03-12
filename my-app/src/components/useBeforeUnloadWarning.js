import { useEffect } from 'react';

const useBeforeUnloadWarning = (shouldWarn) => {
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (shouldWarn) {
        // Some browsers ignore the custom message.
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarn]);
};

export default useBeforeUnloadWarning;
