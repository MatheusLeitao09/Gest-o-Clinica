export function verificarAutenticacao(req, res, next) {
  if (req.session && req.session.usuario) {
    res.locals.usuarioLogado = req.session.usuario;
    return next();
  }
  return res.redirect('/login?erro=sessao_expirada');
}