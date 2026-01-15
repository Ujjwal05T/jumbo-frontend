import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccessTime,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Refresh,
} from '@mui/icons-material';
import { RollbackApiService, RollbackStatus, RollbackResponse } from '../lib/rollback-api';

interface RollbackPlanDialogProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  userId: string;
  onRollbackSuccess?: () => void;
}

export const RollbackPlanDialog: React.FC<RollbackPlanDialogProps> = ({
  open,
  onClose,
  planId,
  planName,
  userId,
  onRollbackSuccess,
}) => {
  const [rollbackStatus, setRollbackStatus] = useState<RollbackStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Fetch rollback status when dialog opens
  useEffect(() => {
    if (open && planId) {
      fetchRollbackStatus();
    }
  }, [open, planId]);

  // Set up timer to update remaining time
  useEffect(() => {
    if (open && rollbackStatus?.remaining_minutes && rollbackStatus.rollback_available) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1/60; // Decrease by 1 second (1/60 minute)
          if (newTime <= 0) {
            fetchRollbackStatus(); // Refresh status when timer expires
            return 0;
          }
          return newTime;
        });
      }, 1000); // Update every second

      return () => clearInterval(interval);
    }
  }, [open, rollbackStatus?.remaining_minutes, rollbackStatus?.rollback_available]);

  const fetchRollbackStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await RollbackApiService.getRollbackStatus(planId);
      setRollbackStatus(status);
      setTimeRemaining(status.remaining_minutes || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check rollback status');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    try {
      setRollingBack(true);
      setError(null);

      const result = await RollbackApiService.rollbackPlan(planId, userId);

      if (result.success) {
        onRollbackSuccess?.();
        onClose();
      } else {
        setError('Rollback failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  const formatTimeRemaining = (minutes: number): string => {
    return RollbackApiService.formatTimeRemaining(minutes);
  };

  const getProgressColor = () => {
    return RollbackApiService.getProgressColor(timeRemaining);
  };

  const getProgressValue = () => {
    return RollbackApiService.getProgressValue(timeRemaining);
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Checking rollback status...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">Rollback Plan</Typography>
              <Chip label={planName} size="small" color="primary" />
            </Box>
            <Tooltip title="Refresh status">
              <IconButton onClick={fetchRollbackStatus} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!rollbackStatus?.rollback_available ? (
            <Box textAlign="center" py={3}>
              <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6" color="error" gutterBottom>
                Rollback Not Available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {rollbackStatus?.reason || 'Unknown reason'}
              </Typography>
              {rollbackStatus?.suggestion && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Suggestion:</strong> {rollbackStatus.suggestion}
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box>
              {/* Timer Section */}
              <Box mb={3}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <AccessTime color={getProgressColor()} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Rollback Window: {formatTimeRemaining(timeRemaining)}
                  </Typography>
                  {timeRemaining <= 3 && (
                    <Chip
                      label="Expiring Soon"
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  )}
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={getProgressValue()}
                  color={getProgressColor()}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Rollback must be completed within 10 minutes of plan execution
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Safety Check Section */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Safety Check Results:
                </Typography>

                {rollbackStatus?.safety_check?.safe ? (
                  <Alert severity="success" icon={<CheckCircle />}>
                    <Typography variant="body2">
                      <strong>✅ Safe to Rollback</strong>
                    </Typography>
                    <Typography variant="body2">
                      {rollbackStatus.safety_check.reason}
                    </Typography>
                  </Alert>
                ) : (
                  <Alert severity="warning" icon={<Warning />}>
                    <Typography variant="body2">
                      <strong>⚠️ Safety Concerns Detected</strong>
                    </Typography>
                    <Typography variant="body2">
                      {rollbackStatus.safety_check?.reason}
                    </Typography>

                    {rollbackStatus.safety_check?.changes_detected && (
                      <Box mt={1}>
                        <Typography variant="body2" fontWeight="bold">
                          Changes detected:
                        </Typography>
                        <List dense>
                          {rollbackStatus.safety_check.changes_detected.map((change, index) => (
                            <ListItem key={index}>
                              <ListItemText primary={`• ${change}`} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Plan Status */}
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Current Plan Status:
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={rollbackStatus?.plan_status || 'Unknown'}
                    size="small"
                    color={
                      rollbackStatus?.plan_status === 'in_progress' ? 'warning' :
                      rollbackStatus?.plan_status === 'completed' ? 'success' :
                      'default'
                    }
                  />
                  <Typography variant="body2" color="text.secondary">
                    Only 'in_progress' plans can be rolled back
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Warning Section */}
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  ⚠️ Important Notice - Plan Will Be Deleted:
                </Typography>
                <Typography variant="body2">
                  Rolling back this plan will:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Delete all inventory items created by this plan</li>
                  <li>Restore original order statuses</li>
                  <li>Undo pending order modifications</li>
                  <li>Delete waste materials generated by this plan</li>
                  <li><strong>Delete the plan itself</strong> - plan will be completely removed</li>
                  <li>Redirect you to the plans list page</li>
                </ul>
                <Typography variant="body2">
                  This action cannot be undone. The plan will be completely removed from the system.
                </Typography>
              </Alert>

              {/* Info Alert */}
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2">
                  <strong>💡 Tip:</strong> If you're unsure, you can close this dialog and return
                  before the rollback window expires.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose} disabled={rollingBack}>
            Cancel
          </Button>

          {rollbackStatus?.rollback_available && (
            <Button
              onClick={handleRollback}
              variant="contained"
              color="error"
              disabled={rollingBack || timeRemaining <= 0}
              startIcon={rollingBack ? <CircularProgress size={20} /> : null}
            >
              {rollingBack ? 'Rolling Back...' : 'Rollback Plan'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};