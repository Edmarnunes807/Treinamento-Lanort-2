const API_URL = "https://script.google.com/macros/s/AKfycbxaN2gPY_jl4fw-0kp14jub_CqylA_j1JClnRKxr5WVCTMVOEh68WXEyWIQkfde2FdgoQ/exec";
const API_AULAS = "https://script.google.com/macros/s/AKfycbxaN2gPY_jl4fw-0kp14jub_CqylA_j1JClnRKxr5WVCTMVOEh68WXEyWIQkfde2FdgoQ/exec";

let usuarioLogado = null;
let todasAulas = [];
let aulasPorCategoria = {};
let aulaAtual = null;
let categoriasAbertas = {};
let arquivosAcesso = [];
let progressoAulas = {};
let aulasConcluidas = [];
let listaUsuarios = [];

document.addEventListener('DOMContentLoaded', function() {
    carregarListaUsuarios();
    
    document.getElementById('input-senha').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') fazerLogin();
    });
    
    document.getElementById('select-usuario').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') fazerLogin();
    });
});

function carregarListaUsuarios() {
    const selectUsuario = document.getElementById('select-usuario');
    selectUsuario.innerHTML = '<option value="">Carregando usuários...</option>';
    
    fetch(`${API_URL}?tipo=usuarios`)
        .then(response => response.json())
        .then(data => {
            if (data.status === "ok" && data.dados && data.dados.length > 0) {
                listaUsuarios = data.dados;
                const usuariosComAcesso = listaUsuarios.filter(usuario => {
                    const temAcesso = usuario['acesso treinamento'] && 
                                    usuario['acesso treinamento'].toString().toLowerCase() === 'sim';
                    return usuario.codigo && usuario.apelido && temAcesso;
                });
                
                selectUsuario.innerHTML = '<option value="">Selecione seu usuário</option>';
                usuariosComAcesso.forEach(usuario => {
                    const option = document.createElement('option');
                    option.value = usuario.codigo;
                    option.textContent = usuario.apelido;
                    selectUsuario.appendChild(option);
                });
            }
        })
        .catch(() => {
            selectUsuario.innerHTML = '<option value="">Erro ao carregar usuários</option>';
        });
}

function atualizarDadosUsuario(dados) {
    if (!usuarioLogado || !usuarioLogado.codigo) return;
    
    const payload = {
        tipo: 'usuarios',
        codigo: usuarioLogado.codigo,
        ...dados
    };
    
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(() => {
        atualizarDadosFallback(payload);
    });
}

function registrarLogAcesso(arquivo) {
    if (!usuarioLogado || !usuarioLogado.codigo) return;
    
    // ✅ CORRIGIDO: Pegar data/hora atual do frontend
    const dataAtual = new Date();
    const dataFormatada = formatarDataRondonia(dataAtual);
    
    const dadosLog = {
        tipo: 'logs', // Para a API saber que é log
        codigo: usuarioLogado.codigo,
        apelido: usuarioLogado.apelido,
        acessou: arquivo.nome,
        local: arquivo.link,
        tipoArquivo: arquivo.tipo && arquivo.tipo.toLowerCase() === 'download' ? 'download' : 'link', // ✅ Nome diferente para evitar conflito
        'dh. acesso': dataFormatada // ✅ ENVIAR DATA/HORA DO FRONTEND
    };
    
    const params = new URLSearchParams();
    params.append('tipo', 'logs');
    params.append('codigo', dadosLog.codigo);
    params.append('apelido', dadosLog.apelido);
    params.append('acessou', dadosLog.acessou);
    params.append('local', dadosLog.local);
    params.append('tipo', dadosLog.tipoArquivo); // ✅ Enviar tipo correto
    params.append('dh. acesso', dadosLog['dh. acesso']); // ✅ ENVIAR DATA/HORA
    
    fetch(`${API_URL}?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.status !== "ok") {
                registrarLogViaPOST(dadosLog);
            }
        })
        .catch(() => {
            registrarLogViaPOST(dadosLog);
        });
}

function registrarLogViaPOST(dadosLog) {
    // ✅ CORRIGIDO: Preparar dados corretos para POST
    const dadosParaEnviar = {
        tipo: 'logs',
        codigo: dadosLog.codigo,
        apelido: dadosLog.apelido,
        acessou: dadosLog.acessou,
        local: dadosLog.local,
        tipo: dadosLog.tipoArquivo, // ✅ Usar tipo correto
        'dh. acesso': dadosLog['dh. acesso'] // ✅ ENVIAR DATA/HORA NO POST TAMBÉM
    };
    
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParaEnviar)
    });
}

function abrirLinkComLog(arquivoNome, arquivoLink, arquivoTipo, event) {
    event.preventDefault();
    
    const arquivo = {
        nome: arquivoNome,
        link: arquivoLink,
        tipo: arquivoTipo
    };
    
    registrarLogAcesso(arquivo);
    
    setTimeout(() => {
        window.open(arquivoLink, '_blank');
        fecharAcessos();
    }, 500);
}

function atualizarDadosFallback(payload) {
    const params = new URLSearchParams();
    params.append('tipo', 'usuarios');
    params.append('codigo', payload.codigo);
    
    if (payload['aulas concluídas']) params.append('aulas concluídas', payload['aulas concluídas']);
    if (payload['aulas disponíveis']) params.append('aulas disponíveis', payload['aulas disponíveis']);
    if (payload['ultimo acesso']) params.append('ultimo acesso', payload['ultimo acesso']);
    
    fetch(`${API_URL}?${params.toString()}`, { method: 'GET' });
}

function fazerLogin() {
    const selectUsuario = document.getElementById('select-usuario');
    const codigo = selectUsuario.value;
    const senha = document.getElementById('input-senha').value;
    
    if (!codigo) {
        mostrarErro('Selecione um usuário');
        return;
    }
    
    if (!senha) {
        mostrarErro('Digite a senha');
        return;
    }
    
    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('login-loading').style.display = 'block';
    
    const urlLogin = `${API_URL}?codigo=${codigo}&senha=${senha}`;
    
    fetch(urlLogin)
        .then(response => response.json())
        .then(data => {
            if (data.status === "ok") {
                usuarioLogado = data.usuario;
                arquivosAcesso = data.arquivosAcesso || [];
                entrarNaPlataforma();
            } else {
                mostrarErro(data.mensagem || 'Erro no login');
            }
        })
        .catch(() => {
            // ✅ MODIFICAÇÃO DE SEGURANÇA: Removido o fallback inseguro
            mostrarErro('Erro de conexão com o servidor');
        })
        .finally(() => {
            document.getElementById('btn-login').style.display = 'block';
            document.getElementById('login-loading').style.display = 'none';
        });
}

function entrarNaPlataforma() {
    carregarDadosUsuario();
    
    document.getElementById('user-name').textContent = usuarioLogado.apelido;
    document.getElementById('user-avatar').textContent = usuarioLogado.apelido.charAt(0);
    
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('platform-container').style.display = 'block';
    
    const dataAtual = new Date();
    const dataFormatada = formatarDataRondonia(dataAtual);
    
    atualizarDadosUsuario({ 'ultimo acesso': dataFormatada });
    
    carregarAulas();
    document.getElementById('buscar-aula').addEventListener('input', filtrarAulas);
}

function formatarDataRondonia(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    const segundos = String(data.getSeconds()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

function abrirAcessos() {
    const modal = document.getElementById('acessos-modal');
    const lista = document.getElementById('acessos-lista');
    
    if (arquivosAcesso.length === 0) {
        lista.innerHTML = '<div class="sem-acessos"><h3>Nenhum acesso disponível</h3><p>Você não tem arquivos liberados no momento.</p></div>';
    } else {
        let html = '';
        arquivosAcesso.forEach(arquivo => {
            const isDownload = arquivo.tipo && arquivo.tipo.toLowerCase() === 'download';
            const botaoClass = isDownload ? 'arquivo-download' : 'arquivo-link';
            const botaoText = isDownload ? '📥 Download' : '🔗 Acessar';
            
            html += `
                <div class="arquivo-item">
                    <div class="arquivo-info">
                        <div class="arquivo-nome">${arquivo.nome}</div>
                        <div class="arquivo-tipo">${isDownload ? 'Download' : 'Link'}</div>
                    </div>
                    ${arquivo.link ? `
                        <a href="${arquivo.link}" class="${botaoClass}" onclick="abrirLinkComLog('${arquivo.nome.replace(/'/g, "\\'")}', '${arquivo.link}', '${arquivo.tipo || 'link'}', event)">${botaoText}</a>
                    ` : '<span style="color: #95a5a6;">Sem link</span>'}
                </div>
            `;
        });
        lista.innerHTML = html;
    }
    
    modal.style.display = 'block';
}

function fecharAcessos() {
    document.getElementById('acessos-modal').style.display = 'none';
}

function carregarDadosUsuario() {
    const dadosCriptografados = localStorage.getItem(`progresso_${usuarioLogado.codigo}`);
    if (dadosCriptografados) {
        try {
            const dados = JSON.parse(atob(dadosCriptografados));
            if (dados && (Date.now() - (dados.timestamp || 0) < 30 * 24 * 60 * 60 * 1000)) {
                progressoAulas = dados.progressoAulas || {};
                aulasConcluidas = dados.aulasConcluidas || [];
                categoriasAbertas = dados.categoriasAbertas || {};
            }
        } catch (e) {
            // Dados corrompidos - usar fallback normal
            const dados = localStorage.getItem(`progresso_${usuarioLogado.codigo}`);
            if (dados) {
                const parsed = JSON.parse(dados);
                progressoAulas = parsed.progressoAulas || {};
                aulasConcluidas = parsed.aulasConcluidas || [];
                categoriasAbertas = parsed.categoriasAbertas || {};
            }
        }
    } else {
        // Fallback para dados não criptografados (compatibilidade)
        const dados = localStorage.getItem(`progresso_${usuarioLogado.codigo}`);
        if (dados) {
            const parsed = JSON.parse(dados);
            progressoAulas = parsed.progressoAulas || {};
            aulasConcluidas = parsed.aulasConcluidas || [];
            categoriasAbertas = parsed.categoriasAbertas || {};
        }
    }
}

function salvarDadosUsuario() {
    const dados = {
        progressoAulas: progressoAulas,
        aulasConcluidas: aulasConcluidas,
        categoriasAbertas: categoriasAbertas,
        timestamp: Date.now()
    };
    
    try {
        // Tentar criptografar
        const dadosCriptografados = btoa(JSON.stringify(dados));
        localStorage.setItem(`progresso_${usuarioLogado.codigo}`, dadosCriptografados);
    } catch (e) {
        // Fallback para salvar sem criptografia
        localStorage.setItem(`progresso_${usuarioLogado.codigo}`, JSON.stringify(dados));
    }
}

function fazerLogout() {
    if (confirm('Deseja realmente sair?')) {
        usuarioLogado = null;
        arquivosAcesso = [];
        document.getElementById('platform-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('input-senha').value = '';
        document.getElementById('select-usuario').selectedIndex = 0;
        carregarListaUsuarios();
    }
}

function mostrarErro(mensagem) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = mensagem;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function carregarAulas() {
    fetch(API_AULAS)
        .then(response => response.json())
        .then(data => {
            if (data.dados && data.dados.length > 0) {
                processarDadosGoogleSheets(data.dados);
                atualizarEstatisticas();
                const totalAulas = todasAulas.length;
                if (totalAulas > 0) {
                    atualizarDadosUsuario({ 'aulas disponíveis': totalAulas.toString() });
                }
            }
        })
        .catch(() => {
            document.getElementById('lista-categorias').innerHTML = '<div class="loading">Erro ao carregar aulas</div>';
        });
}

function processarDadosGoogleSheets(dados) {
    todasAulas = [];
    aulasPorCategoria = {};
    
    dados.forEach(item => {
        const categoria = item.categoria || item[""] || "GERAL";
        const nome = item.nome || "Aula sem nome";
        const url = item.url || "";
        let tipo = item.tipo || "video";
        
        tipo = tipo.toLowerCase();
        if (tipo.includes('vídeo')) tipo = 'video';
        
        if (url && url.includes('drive.google.com') && (tipo === 'video' || tipo === 'pdf')) {
            if (!aulasPorCategoria[categoria]) aulasPorCategoria[categoria] = [];
            
            const aula = {
                nome: nome,
                url: converterUrlParaEmbed(url),
                categoria: categoria,
                tipo: tipo
            };
            
            todasAulas.push(aula);
            aulasPorCategoria[categoria].push(aula);
        }
    });
    
    renderizarCategorias();
}

function converterUrlParaEmbed(url) {
    if (url.includes('/file/d/')) {
        const videoId = url.split('/file/d/')[1].split('/')[0];
        return `https://drive.google.com/file/d/${videoId}/preview`;
    }
    return url;
}

function renderizarCategorias() {
    const container = document.getElementById('lista-categorias');
    
    if (Object.keys(aulasPorCategoria).length === 0) {
        container.innerHTML = '<div class="loading">Nenhum vídeo encontrado</div>';
        return;
    }

    let html = '';
    for (const [categoria, aulas] of Object.entries(aulasPorCategoria)) {
        const aulasConcluidasCategoria = aulas.filter(a => aulasConcluidas.includes(a.nome)).length;
        const progressoCategoria = aulas.length > 0 ? (aulasConcluidasCategoria / aulas.length) * 100 : 0;
        const categoriaConcluida = progressoCategoria === 100;
        const categoriaAberta = categoriasAbertas[categoria] && !categoriaConcluida;

        html += `
            <div class="categoria">
                <div class="categoria-header ${categoriaAberta ? 'aberta' : ''} ${categoriaConcluida ? 'concluida' : ''}" onclick="toggleCategoria('${categoria}')">
                    <div>
                        <div class="categoria-title">${categoria}</div>
                        <div class="categoria-progress">${aulasConcluidasCategoria}/${aulas.length} concluídas</div>
                    </div>
                    <div class="categoria-arrow">▼</div>
                </div>
                <div class="aulas-container" id="aulas-${categoria.replace(/\s+/g, '-')}">
                    ${aulas.map((aula, index) => {
                        const concluida = aulasConcluidas.includes(aula.nome);
                        
                        const classes = [
                            concluida ? 'assistida' : '',
                            aulaAtual && aula.nome === aulaAtual.nome ? 'ativa' : ''
                        ].filter(c => c).join(' ');
                        
                        return `
                        <div class="aula ${classes}" onclick="abrirAula('${aula.nome.replace(/'/g, "\\'")}', '${aula.url}', '${categoria.replace(/'/g, "\\'")}', ${index})">
                            <div class="aula-status">${concluida ? '✓' : (index + 1)}</div>
                            <div class="aula-info">
                                <div class="aula-nome">${aula.nome}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function toggleCategoria(categoria) {
    const categoriaElement = document.querySelector(`[onclick="toggleCategoria('${categoria}')"]`);
    const aulasContainer = document.getElementById(`aulas-${categoria.replace(/\s+/g, '-')}`);
    const estaAberta = categoriaElement.classList.contains('aberta');
    
    document.querySelectorAll('.categoria-header.aberta').forEach(header => {
        const outrasCategoria = header.getAttribute('onclick').match(/toggleCategoria\('([^']+)'\)/)[1];
        const outrasAulas = document.getElementById(`aulas-${outrasCategoria.replace(/\s+/g, '-')}`);
        
        if (outrasAulas) {
            header.classList.remove('aberta');
            outrasAulas.style.display = 'none';
            categoriasAbertas[outrasCategoria] = false;
        }
    });
    
    if (!estaAberta) {
        categoriaElement.classList.add('aberta');
        aulasContainer.style.display = 'grid';
        categoriasAbertas[categoria] = true;
    }
    
    salvarDadosUsuario();
}

function abrirAula(nome, url, categoria, index) {
    aulaAtual = { nome, url, categoria, index };
    
    document.querySelectorAll('.aula').forEach(a => a.classList.remove('ativa'));
    event.currentTarget.classList.add('ativa');
    
    document.getElementById('modal-title').textContent = nome;
    document.getElementById('video-modal').style.display = 'block';
    
    const iframe = document.getElementById('modal-video');
    iframe.src = url;
    
    atualizarBotoesNavegacao();
    atualizarBotaoConclusao();
}

function fecharModal() {
    document.getElementById('video-modal').style.display = 'none';
    document.getElementById('modal-video').src = '';
    
    renderizarCategorias();
    atualizarEstatisticas();
    salvarDadosUsuario();
    verificarCategoriasConcluidas();
}

function verificarCategoriasConcluidas() {
    for (const [categoria, aulas] of Object.entries(aulasPorCategoria)) {
        const aulasConcluidasCategoria = aulas.filter(a => aulasConcluidas.includes(a.nome)).length;
        const progressoCategoria = aulas.length > 0 ? (aulasConcluidasCategoria / aulas.length) * 100 : 0;
        
        if (progressoCategoria === 100) {
            const categoriaElement = document.querySelector(`[onclick="toggleCategoria('${categoria}')"]`);
            const aulasContainer = document.getElementById(`aulas-${categoria.replace(/\s+/g, '-')}`);
            
            if (categoriaElement && aulasContainer) {
                categoriaElement.classList.remove('aberta');
                aulasContainer.style.display = 'none';
                categoriasAbertas[categoria] = false;
            }
        }
    }
}

function alternarConclusao() {
    if (!aulaAtual) return;
    
    const btnConcluir = document.getElementById('btn-concluir');
    const jaConcluida = aulasConcluidas.includes(aulaAtual.nome);
    
    if (jaConcluida) {
        // Desmarcar conclusão
        const index = aulasConcluidas.indexOf(aulaAtual.nome);
        aulasConcluidas.splice(index, 1);
        
        btnConcluir.textContent = '✅ Marcar como Concluída';
        btnConcluir.className = 'btn btn-primary';
    } else {
        // Marcar como concluída
        aulasConcluidas.push(aulaAtual.nome);
        
        btnConcluir.textContent = '↶ Desmarcar Conclusão';
        btnConcluir.className = 'btn btn-warning';
    }
    
    // ✅ AGORA COM VALIDAÇÃO NO BACKEND
    const totalConcluidas = aulasConcluidas.length;
    const totalDisponiveis = todasAulas.length;
    
    atualizarDadosUsuario({
        'aulas concluídas': totalConcluidas.toString(),
        'aulas disponíveis': totalDisponiveis.toString()
    });
    
    renderizarCategorias();
    atualizarEstatisticas();
    salvarDadosUsuario();
}

function atualizarBotaoConclusao() {
    if (!aulaAtual) return;
    
    const btnConcluir = document.getElementById('btn-concluir');
    const jaConcluida = aulasConcluidas.includes(aulaAtual.nome);
    
    if (jaConcluida) {
        btnConcluir.textContent = '↶ Desmarcar Conclusão';
        btnConcluir.className = 'btn btn-warning';
    } else {
        btnConcluir.textContent = '✅ Marcar como Concluída';
        btnConcluir.className = 'btn btn-primary';
    }
}

function proximaAula() {
    if (!aulaAtual) return;
    
    // ✅ NOVO: Marcar aula atual como concluída antes de ir para próxima
    if (!aulasConcluidas.includes(aulaAtual.nome)) {
        aulasConcluidas.push(aulaAtual.nome);
        
        // Atualizar backend
        const totalConcluidas = aulasConcluidas.length;
        const totalDisponiveis = todasAulas.length;
        
        atualizarDadosUsuario({
            'aulas concluídas': totalConcluidas.toString(),
            'aulas disponíveis': totalDisponiveis.toString()
        });
    }
    
    const aulasCategoria = aulasPorCategoria[aulaAtual.categoria];
    const proximaIndex = aulaAtual.index + 1;
    
    if (proximaIndex < aulasCategoria.length) {
        const proximaAula = aulasCategoria[proximaIndex];
        abrirAula(proximaAula.nome, proximaAula.url, aulaAtual.categoria, proximaIndex);
    } else {
        // Se for a última aula, apenas fecha o modal
        fecharModal();
    }
}

function aulaAnterior() {
    if (!aulaAtual) return;
    
    // ✅ NOVO: Desmarcar conclusão da aula atual ao voltar
    if (aulasConcluidas.includes(aulaAtual.nome)) {
        const index = aulasConcluidas.indexOf(aulaAtual.nome);
        aulasConcluidas.splice(index, 1);
        
        // Atualizar backend
        const totalConcluidas = aulasConcluidas.length;
        const totalDisponiveis = todasAulas.length;
        
        atualizarDadosUsuario({
            'aulas concluídas': totalConcluidas.toString(),
            'aulas disponíveis': totalDisponiveis.toString()
        });
    }
    
    const aulasCategoria = aulasPorCategoria[aulaAtual.categoria];
    const anteriorIndex = aulaAtual.index - 1;
    
    if (anteriorIndex >= 0) {
        const aulaAnterior = aulasCategoria[anteriorIndex];
        abrirAula(aulaAnterior.nome, aulaAnterior.url, aulaAtual.categoria, anteriorIndex);
    }
}

function atualizarBotoesNavegacao() {
    if (!aulaAtual) return;
    
    const aulasCategoria = aulasPorCategoria[aulaAtual.categoria];
    const btnAnterior = document.getElementById('btn-anterior');
    const btnProximo = document.getElementById('btn-proximo');
    
    btnAnterior.disabled = aulaAtual.index === 0;
    btnProximo.disabled = aulaAtual.index === aulasCategoria.length - 1;
}

function atualizarEstatisticas() {
    const totalAulas = todasAulas.length;
    const concluidas = aulasConcluidas.length;
    const progresso = totalAulas > 0 ? (concluidas / totalAulas) * 100 : 0;
    
    document.getElementById('progresso-geral').style.width = `${progresso}%`;
    document.getElementById('texto-progresso').textContent = `${Math.round(progresso)}% concluído`;
    document.getElementById('total-aulas').textContent = totalAulas;
    document.getElementById('aulas-concluidas').textContent = concluidas;
    document.getElementById('aulas-assistindo').textContent = '0';
}

function filtrarAulas() {
    const termo = document.getElementById('buscar-aula').value.toLowerCase();
    
    if (termo === '') {
        renderizarCategorias();
        return;
    }
    
    const aulasFiltradas = todasAulas.filter(aula => 
        aula.nome.toLowerCase().includes(termo) || 
        aula.categoria.toLowerCase().includes(termo)
    );
    
    const aulasFiltradasPorCategoria = {};
    aulasFiltradas.forEach(aula => {
        if (!aulasFiltradasPorCategoria[aula.categoria]) aulasFiltradasPorCategoria[aula.categoria] = [];
        aulasFiltradasPorCategoria[aula.categoria].push(aula);
    });
    
    aulasPorCategoria = aulasFiltradasPorCategoria;
    renderizarCategorias();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        fecharModal();
        fecharAcessos();
    }
});

document.getElementById('video-modal').addEventListener('click', function(e) {
    if (e.target === this) fecharModal();
});

document.getElementById('acessos-modal').addEventListener('click', function(e) {
    if (e.target === this) fecharAcessos();
});
