import nodemailer, { type SendMailOptions } from 'nodemailer'
import hbs from 'nodemailer-express-handlebars'
import path from 'path'

interface HbsMailOptions extends SendMailOptions {
    template?: string;
    context?: Record<string, unknown>;
}

/**
 * Configure Nodemailer transporter with Gmail SMTP
 * Replace Gmail SMTP with other providers (Zoho, Outlook, SES) if needed
 */
const transporter = nodemailer.createTransport({
    host: Bun.env.NODEMAILER_HOST,
    port: Number(Bun.env.NODEMAILER_PORT),
    secure: Bun.env.NODEMAILER_SECURE === 'true', // true for 465, false for 587
    auth: {
        user: Bun.env.NODEMAILER_AUTH_USER,
        pass: Bun.env.NODEMAILER_AUTH_PASSWORD
    }
})

/**
 * Setup Handlebars template engine
 */
transporter.use(
    'compile',
    hbs({
        viewEngine: {
            extname: '.hbs',
            layoutsDir: path.resolve('src/users/auth/emails/templates'),
            defaultLayout: false
        },
        viewPath: path.resolve('src/users/auth/emails/templates'),
        extName: '.hbs'
    })
)

/**
 * Send verification email to user
 * @param to - recipient email
 * @param name - recipient name
 * @param token - verify token
 */
export async function sendVerifyEmail(to: string, name: string, token: string) {
    const verifyUrl = `${Bun.env.USER_URL}/auth/verify-email?token=${token}`

    return transporter.sendMail({
        from: `"Task Manager" <${Bun.env.NODEMAILER_AUTH_USER}>`,
        to,
        subject: 'Verify your email address',
        template: 'verifyEmail',
        context: {
            name,
            verifyUrl,
            year: new Date().getFullYear()
        }
    } as HbsMailOptions)
}
