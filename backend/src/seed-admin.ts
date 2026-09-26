import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@randzmedical.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@RZ2024!';
  const prenom = 'Super';
  const nom = 'Admin';

  const existing = await prisma.utilisateur.findFirst({ where: { email, typeUtilisateur: 'ADMIN' } });
  if (existing) {
    console.log(`✅ Admin déjà existant : ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.utilisateur.create({
    data: {
      email,
      motDePasseHash: hash,
      prenom,
      nom,
      typeUtilisateur: 'ADMIN',
    },
  });

  console.log(`\n✅ Compte Admin créé avec succès !`);
  console.log(`   Email    : ${email}`);
  console.log(`   Password : ${password}`);
  console.log(`\n⚠️  Changez ce mot de passe après votre première connexion.\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
