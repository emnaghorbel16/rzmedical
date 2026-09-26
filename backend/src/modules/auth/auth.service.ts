import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'rzmedical_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const OTP_EXPIRY_MINUTES = 10;

// Create email transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

// Generate a 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Step 1: Validate credentials and send OTP
export async function login(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.utilisateur.findFirst({ where: { email, typeUtilisateur: 'ADMIN' } });

  if (!user) {
    throw new Error("L'adresse email n'existe pas dans la base de données.");
  }


  const valid = await bcrypt.compare(password, user.motDePasseHash);
  if (!valid) {
    throw new Error('Mot de passe incorrect.');
  }
  // Generate JWT immediately (no OTP)
  const token = jwt.sign(
    { id: user.id, email: user.email, type: user.typeUtilisateur },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as any
  );

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { dernierLogin: new Date() },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      telephone: user.telephone,
      photo: user.photo,
    },
  };
}

// Step 2: Verify OTP and return JWT
export async function verifyOtp(emailInput: string, otp: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.utilisateur.findFirst({ where: { email, typeUtilisateur: 'ADMIN' } });

  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  if (!user.otpCode || !user.otpExpire) {
    throw new Error('Aucun code OTP en attente. Veuillez vous reconnecter.');
  }

  if (new Date() > user.otpExpire) {
    throw new Error('Le code OTP a expiré. Veuillez vous reconnecter.');
  }

  if (user.otpCode !== otp) {
    throw new Error('Code OTP incorrect');
  }

  // Clear OTP and update last login
  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpire: null, dernierLogin: new Date() },
  });

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, type: user.typeUtilisateur },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as any
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      telephone: user.telephone,
      photo: user.photo,
    },
  };
}

// Send OTP by email
async function sendOtpEmail(email: string, otp: string, prenom: string) {
  // If no email config, log to console (dev mode)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n📧 [DEV MODE] Code OTP pour ${email}: ${otp}\n`);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'RZMedical Admin'}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Votre code de connexion RZMedical',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e40af; margin-bottom: 8px;">RZMedical</h2>
        <p style="color: #6b7280;">Bonjour ${prenom},</p>
        <p style="color: #374151;">Voici votre code de connexion :</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Ce code expire dans <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
        <p style="color: #ef4444; font-size: 14px;">⚠️ Ne partagez jamais ce code avec quelqu'un.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
      </div>
    `,
  });
}

// Create a new admin (only callable by existing admin)
export async function createAdmin(email: string, password: string, prenom?: string, nom?: string) {
  const existing = await prisma.utilisateur.findFirst({ where: { email, typeUtilisateur: 'ADMIN' } });
  if (existing) {
    throw new Error('Un utilisateur avec cet email existe déjà');
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.utilisateur.create({
    data: {
      email,
      motDePasseHash: hash,
      prenom,
      nom,
      typeUtilisateur: 'ADMIN',
    },
  });

  return { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom };
}

// List all admins
export async function listAdmins() {
  return prisma.utilisateur.findMany({
    where: { typeUtilisateur: 'ADMIN' },
    select: { id: true, email: true, prenom: true, nom: true, dernierLogin: true, creeLe: true },
    orderBy: { creeLe: 'desc' },
  });
}

// Delete admin
export async function deleteAdmin(id: number) {
  return prisma.utilisateur.delete({ where: { id } });
}

// Get user profile
export async function getUserProfile(userId: number, emailFallback?: string) {
  let user = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      prenom: true,
      nom: true,
      telephone: true,
      photo: true,
      typeUtilisateur: true,
      creeLe: true,
      dernierLogin: true,
    },
  });

  if (!user && emailFallback) {
    user = await prisma.utilisateur.findFirst({
      where: { email: emailFallback.trim().toLowerCase(), typeUtilisateur: 'ADMIN' },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        telephone: true,
        photo: true,
        typeUtilisateur: true,
        creeLe: true,
        dernierLogin: true,
      },
    });
  }

  if (!user) throw new Error('Utilisateur non trouvé');
  return user;
}

// Update profile
export async function updateProfile(
  userId: number,
  emailFallback: string | undefined,
  data: {
    prenom?: string;
    nom?: string;
    telephone?: string;
    photo?: string;
    currentPassword?: string;
    newPassword?: string;
  }
) {
  let user = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!user && emailFallback) {
    user = await prisma.utilisateur.findFirst({ where: { email: emailFallback.trim().toLowerCase(), typeUtilisateur: 'ADMIN' } });
  }

  if (!user) throw new Error('Utilisateur non trouvé');

  const updateData: any = {};

  if (data.prenom !== undefined) updateData.prenom = data.prenom;
  if (data.nom !== undefined) updateData.nom = data.nom;
  if (data.telephone !== undefined) updateData.telephone = data.telephone;
  if (data.photo !== undefined) updateData.photo = data.photo;

  // Password change if requested
  if (data.newPassword) {
    if (!data.currentPassword) {
      throw new Error('Mot de passe actuel requis pour changer le mot de passe');
    }
    const valid = await bcrypt.compare(data.currentPassword, user.motDePasseHash);
    if (!valid) {
      throw new Error('Mot de passe actuel incorrect');
    }
    if (data.newPassword.length < 8) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');
    }
    updateData.motDePasseHash = await bcrypt.hash(data.newPassword, 12);
  }

  const updated = await prisma.utilisateur.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      prenom: true,
      nom: true,
      telephone: true,
      photo: true,
      typeUtilisateur: true,
    },
  });

  return updated;
}

export { JWT_SECRET };
