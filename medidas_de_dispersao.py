import math
from collections import Counter

LARGURA = 66
LINHA = "=" * LARGURA
TRACO = "-" * LARGURA

CV_BAIXA = 15.0      # CV <= 15%        -> dispersão baixa
CV_MODERADA = 30.0   # 15% < CV <= 30%  -> dispersão moderada
                     # CV > 30%         -> dispersão alta


def fmt(valor, casas=4):
    texto = f"{valor:,.{casas}f}"
    return texto.replace(",", "#").replace(".", ",").replace("#", ".")


def titulo(texto):
    print("\n" + LINHA)
    print(texto.center(LARGURA))
    print(LINHA)


def ler_opcao(pergunta, opcoes):
    print("\n" + pergunta)
    for chave, descricao in opcoes.items():
        print(f"  [{chave}] {descricao}")
    while True:
        escolha = input("Escolha uma opção: ").strip()
        if escolha in opcoes:
            return escolha
        print("  >> Opção inválida. Digite um dos números indicados.")


def para_numero(texto):
    return float(texto.strip().replace(",", "."))


def ler_numeros(pergunta, quantidade=None):
    while True:
        bruto = input(pergunta).replace(";", " ").split()
        try:
            numeros = [para_numero(t) for t in bruto]
        except ValueError:
            print("  >> Há um valor que não é número. Separe os valores por "
                  "espaço ou ';' e use vírgula ou ponto apenas como decimal.")
            continue
        if quantidade is not None and len(numeros) != quantidade:
            print(f"  >> Informe exatamente {quantidade} valor(es).")
            continue
        if not numeros:
            print("  >> Nenhum valor informado.")
            continue
        return numeros


def ler_inteiro_positivo(pergunta):
    while True:
        try:
            n = int(input(pergunta).strip())
            if n > 0:
                return n
        except ValueError:
            pass
        print("  >> Digite um número inteiro maior que zero.")


def entrada_discreta():
    formato = ler_opcao(
        "Como deseja informar os dados discretos?",
        {"1": "Rol (lista de valores, ex.: 4 7 7 9 12)",
         "2": "Tabela valor:frequência (ex.: 4:1 7:2 9:1 12:1)"})

    contagem = Counter()
    if formato == "1":
        print("\nDigite todos os valores separados por espaço ou ';'.")
        for v in ler_numeros("Valores: "):
            contagem[v] += 1
    else:
        print("\nDigite os pares valor:frequência separados por espaço.")
        while True:
            pares = input("Pares: ").replace(";", " ").split()
            try:
                contagem.clear()
                for par in pares:
                    valor, freq = par.split(":")
                    freq_num = para_numero(freq)
                    if freq_num <= 0 or freq_num != int(freq_num):
                        raise ValueError
                    contagem[para_numero(valor)] += int(freq_num)
                if not contagem:
                    raise ValueError
                break
            except ValueError:
                print("  >> Formato inválido. Use valor:frequência com "
                      "frequência inteira positiva (ex.: 5:3 8:2).")

    pontos = sorted(contagem)
    frequencias = [contagem[p] for p in pontos]
    amplitude = max(pontos) - min(pontos)
    tabela = {"tipo": "discreto", "linhas": list(zip(pontos, frequencias))}
    return pontos, frequencias, amplitude, tabela


def entrada_intervalar():
    qtd = ler_inteiro_positivo("\nQuantas classes a tabela possui? ")
    print("\nPara cada classe informe: limite_inferior limite_superior "
          "frequencia")
    print("(exemplo: 10 20 5  -> classe de 10 a 20 com frequência 5)")

    classes = []
    for i in range(1, qtd + 1):
        while True:
            valores = ler_numeros(f"Classe {i}: ", quantidade=3)
            li, ls, fi = valores
            if ls <= li:
                print("  >> O limite superior deve ser maior que o inferior.")
            elif fi <= 0 or fi != int(fi):
                print("  >> A frequência deve ser um inteiro positivo.")
            else:
                classes.append((li, ls, int(fi)))
                break

    classes.sort(key=lambda c: c[0])
    for anterior, atual in zip(classes, classes[1:]):
        if atual[0] < anterior[1]:
            print("\n  >> ERRO: as classes se sobrepõem "
                  f"({fmt(anterior[0], 2)}-{fmt(anterior[1], 2)} e "
                  f"{fmt(atual[0], 2)}-{fmt(atual[1], 2)}). "
                  "Digite a tabela novamente.")
            return entrada_intervalar()

    pontos = [(li + ls) / 2 for li, ls, _ in classes]   
    frequencias = [fi for _, _, fi in classes]
    amplitude = classes[-1][1] - classes[0][0]  
    tabela = {"tipo": "intervalar", "linhas": classes}
    return pontos, frequencias, amplitude, tabela


def calcular(pontos, frequencias, amostra, amplitude):
    n = sum(frequencias)
    media = sum(f * x for x, f in zip(pontos, frequencias)) / n
    soma_quadrados = sum(f * (x - media) ** 2
                         for x, f in zip(pontos, frequencias))

    divisor = (n - 1) if amostra else n
    variancia = soma_quadrados / divisor
    desvio = math.sqrt(variancia)
    cv = (desvio / abs(media) * 100) if media != 0 else None

    return {"n": n, "media": media, "soma_quadrados": soma_quadrados,
            "divisor": divisor, "amplitude": amplitude,
            "variancia": variancia, "desvio": desvio, "cv": cv}


def classificar_cv(cv):
    if cv <= CV_BAIXA:
        return "BAIXA", ("Os dados são homogêneos: estão concentrados em torno "
                         "da média, que é bastante representativa.")
    if cv <= CV_MODERADA:
        return "MODERADA", ("Há variabilidade intermediária: a média representa "
                            "o conjunto, mas com ressalvas.")
    return "ALTA", ("Os dados são heterogêneos: a média tem pouca "
                    "representatividade e deve ser interpretada com cuidado.")

def mostrar_tabela(tabela, media):
    print("\nDADOS INFORMADOS")
    print(TRACO)
    if tabela["tipo"] == "discreto":
        print(f"{'Valor (xi)':>14}{'Freq. (fi)':>14}")
        for x, f in tabela["linhas"]:
            print(f"{fmt(x, 2):>14}{f:>14}")
    else:
        print(f"{'Classe':>20}{'fi':>6}{'xi (pt. médio)':>16}"
              f"{'fi·xi':>12}")
        for li, ls, fi in tabela["linhas"]:
            xi = (li + ls) / 2
            classe = f"{fmt(li, 2)} |-- {fmt(ls, 2)}"
            print(f"{classe:>20}{fi:>6}{fmt(xi, 2):>16}{fmt(fi * xi, 2):>12}")
    print(TRACO)


def mostrar_resultados(res, amostra, tipo_dados):
    rotulo_conjunto = "AMOSTRA" if amostra else "POPULAÇÃO"
    rotulo_dados = "DISCRETOS" if tipo_dados == "1" else "INTERVALARES"

    titulo("RESULTADOS")
    print(f"Tipo de dados .............: {rotulo_dados}")
    print(f"Tipo de conjunto ..........: {rotulo_conjunto}")
    print(f"Total de observações (N) ..: {res['n']}")
    print(f"Média aritmética ..........: {fmt(res['media'])}")
    print(TRACO)

    simbolo_var = "s²" if amostra else "σ²"
    simbolo_dp = "s" if amostra else "σ"
    divisor_txt = "N - 1" if amostra else "N"

    print("1) AMPLITUDE")
    if tipo_dados == "1":
        print("   Fórmula: maior valor - menor valor")
    else:
        print("   Fórmula: limite superior da última classe - "
              "limite inferior da primeira")
    print(f"   Amplitude = {fmt(res['amplitude'])}\n")

    print(f"2) VARIÂNCIA ({simbolo_var})")
    print(f"   Fórmula: Σ fi·(xi - média)² / ({divisor_txt})")
    print(f"   Σ fi·(xi - média)² = {fmt(res['soma_quadrados'])}")
    print(f"   Divisor ({divisor_txt}) = {res['divisor']}")
    print(f"   Variância = {fmt(res['variancia'])}\n")

    print(f"3) DESVIO-PADRÃO ({simbolo_dp})")
    print(f"   Fórmula: raiz quadrada da variância")
    print(f"   Desvio-padrão = {fmt(res['desvio'])}\n")

    print("4) COEFICIENTE DE VARIAÇÃO (CV)")
    print(f"   Fórmula: ({simbolo_dp} / |média|) × 100")
    if res["cv"] is None:
        print("   CV = indefinido (a média é igual a zero).")
        conclusao = None
    else:
        print(f"   CV = {fmt(res['cv'])}%")
        nivel, explicacao = classificar_cv(res["cv"])
        conclusao = (nivel, explicacao)
    print(TRACO)

    print("CONCLUSÃO")
    if conclusao is None:
        print("   Não é possível classificar a dispersão relativa, pois o CV "
              "não está definido\n   quando a média é zero. Use o "
              "desvio-padrão para avaliar a variabilidade.")
    else:
        nivel, explicacao = conclusao
        print(f"   A dispersão é {nivel} (CV = {fmt(res['cv'], 2)}%).")
        print(f"   {explicacao}")
    print("\n   Critério: CV ≤ 15% baixa | 15% < CV ≤ 30% moderada | "
          "CV > 30% alta")
    print(LINHA)

def executar_calculo():
    titulo("CALCULADORA DE MEDIDAS DE DISPERSÃO")

    tipo_dados = ler_opcao("Qual é o TIPO DE DADOS?",
                           {"1": "Discretos", "2": "Intervalares (classes)"})
    tipo_conjunto = ler_opcao("O conjunto é uma AMOSTRA ou uma POPULAÇÃO?",
                              {"1": "Amostra", "2": "População"})
    amostra = tipo_conjunto == "1"

    if tipo_dados == "1":
        pontos, freqs, amplitude, tabela = entrada_discreta()
    else:
        pontos, freqs, amplitude, tabela = entrada_intervalar()

    if amostra and sum(freqs) < 2:
        print("\n  >> ERRO: uma amostra precisa ter pelo menos 2 observações "
              "(o divisor é N - 1).")
        return

    res = calcular(pontos, freqs, amostra, amplitude)
    mostrar_tabela(tabela, res["media"])
    mostrar_resultados(res, amostra, tipo_dados)


def main():
    try:
        while True:
            executar_calculo()
            resp = input("\nDeseja realizar um novo cálculo? (s/n): ")
            if resp.strip().lower() not in ("s", "sim"):
                break
        print("\nPrograma encerrado. Obrigado!")
    except (KeyboardInterrupt, EOFError):
        print("\n\nPrograma interrompido pelo usuário.")


if __name__ == "__main__":
    main()