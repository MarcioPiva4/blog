import type { Blog } from "@/db/schema";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";

export function BlogForm({ blog, action, rootDomain }: { blog?: Blog; action: (fd: FormData) => Promise<void>; rootDomain: string }) {
  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader title="Identidade" description="Como o blog aparece para leitores e para o Google." />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Nome">
            <Input name="name" defaultValue={blog?.name} required />
          </Field>
          <Field label="Slug (subdomínio)" hint={`Endereço: <slug>.${rootDomain}`}>
            <Input name="slug" defaultValue={blog?.slug} placeholder="gerado a partir do nome" />
          </Field>
          <Field label="Slogan" className="md:col-span-2">
            <Input name="tagline" defaultValue={blog?.tagline} placeholder="Dinheiro e direitos explicados sem complicação." />
          </Field>
          <Field label="Descrição (meta description da home)" className="md:col-span-2">
            <Textarea name="description" rows={2} defaultValue={blog?.description} maxLength={200} />
          </Field>
          <Field label="Nicho">
            <Input name="niche" defaultValue={blog?.niche} placeholder="Finanças pessoais" />
          </Field>
          <Field label="Idioma">
            <Select name="language" defaultValue={blog?.language ?? "pt-BR"}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="Tema">
            <Select name="theme" defaultValue={blog?.theme ?? "minimal"}>
              <option value="minimal">Minimal — coluna única, foco em leitura</option>
              <option value="magazine">Magazine — destaque + grade de cards</option>
              <option value="editorial">Editorial — serifada, estilo revista</option>
            </Select>
          </Field>
          <Field label="Cor da marca">
            <div className="flex gap-2">
              <input type="color" name="brandColor" defaultValue={blog?.brandColor ?? "#4f46e5"} className="h-9 w-12 cursor-pointer rounded-lg border bg-card p-1" />
              <Input name="logoUrl" defaultValue={blog?.logoUrl ?? ""} placeholder="URL do logo (opcional)" />
            </div>
          </Field>
          <Field label="E-mail de contato" hint="Aparece na página Contato (exigida pelo AdSense).">
            <Input name="contactEmail" type="email" defaultValue={blog?.contactEmail ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Automação com IA" description="O que a IA lê via MCP antes de escrever." />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Guia editorial" className="md:col-span-2" hint="Público, tom de voz, estrutura obrigatória, fontes confiáveis, o que evitar.">
            <Textarea name="editorialGuide" rows={8} defaultValue={blog?.editorialGuide} className="font-mono text-xs" />
          </Field>
          <Field label="Posts por dia">
            <Input name="postsPerDay" type="number" min={1} max={10} defaultValue={blog?.postsPerDay ?? 1} />
          </Field>
          <Field label="Posts criados pela IA entram como">
            <Select name="aiPostStatus" defaultValue={blog?.aiPostStatus ?? "scheduled"}>
              <option value="scheduled">Agendado (publica sozinho)</option>
              <option value="review">Revisão (você aprova antes)</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Monetização" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="AdSense Publisher ID" hint="Gera o ads.txt automaticamente.">
            <Input name="adsensePubId" defaultValue={blog?.adsensePubId ?? ""} placeholder="pub-0000000000000000" />
          </Field>
          <Field label="Anúncio no texto após o parágrafo nº" hint="0 desliga anúncios no meio do texto.">
            <Input name="inContentAdAfter" type="number" min={0} max={20} defaultValue={blog?.inContentAdAfter ?? 3} />
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="adsEnabled" defaultChecked={blog?.adsEnabled} className="h-4 w-4 accent-[var(--primary)]" />
            Exibir anúncios (ligue só depois da aprovação do AdSense)
          </label>
          <Field label="Aviso de afiliados" className="md:col-span-2" hint="Mostrado em posts com produtos recomendados.">
            <Textarea name="affiliateDisclosure" rows={2} defaultValue={blog?.affiliateDisclosure} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button>{blog ? "Salvar alterações" : "Criar blog"}</Button>
      </div>
    </form>
  );
}
