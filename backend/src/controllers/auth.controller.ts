import { Request, Response } from 'express';
import { IAuthService } from '../services/auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';
import { UpdateProfileDto } from '../validators/auth.validator';

export class AuthController {
  constructor(private readonly authService: IAuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(req.body);
    sendCreated(res, result, 'Account created successfully');
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(req.body);
    sendSuccess(res, result, 'Logged in successfully');
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.verifyEmail(req.user!.id, req.body.code);
    sendSuccess(res, { user }, 'Email подтверждён');
  };

  resendVerification = async (req: Request, res: Response): Promise<void> => {
    await this.authService.resendVerification(req.user!.id);
    sendNoContent(res);
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const origin = req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
    await this.authService.forgotPassword(req.body.email, origin);
    sendSuccess(res, null, 'If that account exists, a reset link has been sent');
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    await this.authService.resetPassword(req.body.token, req.body.password);
    sendNoContent(res);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const tokens = await this.authService.refresh(req.body.refreshToken);
    sendSuccess(res, tokens, 'Tokens refreshed');
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logout(req.body.refreshToken);
    sendNoContent(res);
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.authService.getProfile(req.user!.id);
    sendSuccess(res, profile);
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const updated = await this.authService.updateProfile(
      req.user!.id,
      req.body as UpdateProfileDto,
    );
    sendSuccess(res, updated, 'Profile updated');
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    await this.authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    sendNoContent(res);
  };

  updateAvatar = async (req: Request, res: Response): Promise<void> => {
    const updated = await this.authService.updateAvatar(req.user!.id, req.body.avatar);
    sendSuccess(res, updated, 'Avatar updated');
  };

  twoFactor = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.twoFactorLogin(req.body.twoFactorToken, req.body.code);
    sendSuccess(res, result, 'Logged in successfully');
  };

  setTwoFactor = async (req: Request, res: Response): Promise<void> => {
    const updated = await this.authService.setTwoFactor(
      req.user!.id,
      req.body.enabled,
      req.body.code,
    );
    sendSuccess(res, updated, 'Two-factor authentication updated');
  };

  requestDisableTwoFactor = async (req: Request, res: Response): Promise<void> => {
    await this.authService.requestDisableTwoFactor(req.user!.id);
    sendNoContent(res);
  };
}
