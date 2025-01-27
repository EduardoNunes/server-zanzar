import * as Yup from 'yup';

export const registerValidation = Yup.object().shape({
  email: Yup.string()
    .email('O email deve ser um endereço de email válido')
    .required('O email é obrigatório')
    .matches(
      /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      'O email deve conter um domínio válido',
    )
    .test(
      'no-disposable-email',
      'Emails descartáveis não são permitidos',
      async (value) => {
        const disposableDomains = [
          'yopmail.com',
          'mailinator.com',
          'tempmail.com',
        ];
        const domain = value.split('@')[1];
        return !disposableDomains.includes(domain);
      },
    ),
  password: Yup.string()
    .required('A senha é obrigatória')
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .matches(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .matches(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .matches(/[0-9]/, 'A senha deve conter pelo menos um número')
    .matches(
      /[!@#$%^&*(),.?":{}|<>]/,
      'A senha deve conter pelo menos um caractere especial',
    ),
});
