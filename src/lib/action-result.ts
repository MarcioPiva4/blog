/** Retorno das Server Actions das telas de gestão do painel (mostrado como aviso na tela). */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
