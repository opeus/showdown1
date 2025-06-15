'use client';

interface HostVolunteerModalProps {
  visible: boolean;
  secondsRemaining: number;
  onVolunteer: () => void;
  isVolunteering: boolean;
}

export default function HostVolunteerModal({ 
  visible, 
  secondsRemaining, 
  onVolunteer,
  isVolunteering 
}: HostVolunteerModalProps) {
  if (!visible) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const getCountdownClass = () => {
    if (secondsRemaining <= 10) return 'text-danger fw-bold';
    if (secondsRemaining <= 30) return 'text-warning';
    return 'text-muted';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      
      {/* Modal */}
      <div className="modal fade show d-block" style={{ zIndex: 1051 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0">
              <h5 className="modal-title w-100 text-center">
                <i className="bi bi-person-x text-warning me-2"></i>
                Host Has Left The Game
              </h5>
            </div>
            <div className="modal-body text-center py-4">
              <p className="fs-5 mb-4">
                Would you like to become the new host and keep the game going?
              </p>
              
              <button 
                className="btn btn-primary btn-lg px-5 mb-4"
                onClick={onVolunteer}
                disabled={isVolunteering}
              >
                {isVolunteering ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Processing...</span>
                    </span>
                    Claiming Host...
                  </>
                ) : (
                  <>
                    <i className="bi bi-crown me-2"></i>
                    Become Host
                  </>
                )}
              </button>

              <div className={`fs-5 ${getCountdownClass()}`}>
                Game will end in: <strong>{timeDisplay}</strong>
                {secondsRemaining <= 10 && (
                  <div className="small mt-2">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    Game ending soon!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}