# 📘 Runbook Operacional: Migração Oracle XE 21c (Docker para VirtualBox)

Este documento descreve o procedimento operacional padrão para migração de um banco de dados **Oracle XE 21c** em container **Docker (Windows)** para uma instalação nativa em máquina virtual dedicada **VirtualBox com Oracle Linux 8.10**, utilizando **Oracle Data Pump (`expdp` / `impdp`)**.

---

## 📋 Cenário da Migração

* **Ambiente de Origem:** Oracle XE 21c rodando em container Docker (Windows).
* **Ambiente de Destino:** Oracle XE 21c nativo em VM VirtualBox (Oracle Linux 8.10).
* **Ferramenta de Migração:** Oracle Data Pump (`expdp` e `impdp`).
* **Validação de Conexão:** DBeaver e SQL*Plus via TCP/IP na porta 1521.

---

## 1. Exportação do Banco no Container Docker

### 1.1 Acesso ao Container
```bash
# Obter o prompt bash dentro do container oracle-xe
docker exec -it oracle-xe bash
```

### 1.2 Criação do Diretório Físico do Dump
```bash
# Dentro do container Linux:
mkdir -p /opt/oracle/oradata/dump
```

### 1.3 Criação do Objeto de Diretório no PDB Oracle
```bash
# Conectar no PDB XEPDB1 via sqlplus local
sqlplus system/SUA_SENHA@XEPDB1
```
No SQL*Plus:
```sql
CREATE OR REPLACE DIRECTORY DPUMP_DIR AS '/opt/oracle/oradata/dump';
EXIT;
```

### 1.4 Execução do Export (expdp)
```bash
expdp system/SUA_SENHA@XEPDB1 full=y \
  directory=DPUMP_DIR \
  dumpfile=full_export.dmp \
  logfile=full_export.log
```
> **Nota:** O erro `ORA-39127` relacionado a `DBMS_JVM_EXP_PERMS` é comum no Oracle XE e não afeta os schemas nem os dados dos usuários.

### 1.5 Cópia do Dump para o Host Windows
No terminal do Windows:
```bash
docker cp oracle-xe:/opt/oracle/oradata/dump/full_export.dmp "%USERPROFILE%\full_export.dmp"
```

---

## 2. Configuração da VM com Oracle Linux 8.10

### 2.1 Especificações da Máquina Virtual (VirtualBox)
* **Sistema Operacional:** Oracle Linux (64-bit).
* **Memória RAM:** 4096 MB (mínimo 2048 MB).
* **Processadores (vCPUs):** 2 núcleos.
* **Disco Virtual:** 50 GB (alocação dinâmica).
* **Configuração de Rede:** Modo **Bridge** (para permitir que a máquina física e a VM compartilhem a mesma faixa de IP local).

### 2.2 Fixação de Rede e Conexão SSH
No terminal do Oracle Linux (como root):
```bash
# Obter IP local da interface enp0s3
ip addr show enp0s3

# Garantir que a rede inicialize automaticamente no boot
nmcli connection modify enp0s3 connection.autoconnect yes
nmcli connection up enp0s3
```

---

## 3. Instalação e Configuração do Oracle XE 21c na VM

### 3.1 Instalação dos Pacotes Pré-Requisitos e RPM
Conectado via SSH na VM como `root`:
```bash
# 1. Instalar pacote de pré-requisitos do kernel Oracle
dnf install -y oracle-database-preinstall-21c

# 2. Instalar o pacote do Oracle Database 21c XE
dnf install -y https://download.oracle.com/otn-pub/otn_software/db-express/oracle-database-xe-21c-1.0-1.ol8.x86_64.rpm

# 3. Configurar a instância do banco (definir senha administrativa)
/etc/init.d/oracle-xe-21c configure
```

### 3.2 Liberação no Firewall do Linux
```bash
# Liberar porta 1521 do Oracle Listener
firewall-cmd --permanent --add-port=1521/tcp
firewall-cmd --reload
```

---

## 4. Importação dos Dados com Data Pump (impdp)

### 4.1 Transferência do Dump para a VM via SCP
No terminal do Windows:
```bash
scp "%USERPROFILE%\full_export.dmp" usuario_vm@IP_DA_VM:/tmp/
```

### 4.2 Ajuste de Permissões de Diretório na VM
No SSH da VM (como root):
```bash
mkdir -p /opt/oracle/oradata/dump
cp /tmp/full_export.dmp /opt/oracle/oradata/dump/
chown -R oracle:oinstall /opt/oracle/oradata/dump
chmod 755 /opt/oracle/oradata/dump
```

### 4.3 Criação do Diretório Oracle e Importação
Mude para o usuário `oracle` e exporte as variáveis de ambiente:
```bash
su - oracle
export ORACLE_HOME=/opt/oracle/product/21c/dbhomeXE
export PATH=$ORACLE_HOME/bin:$PATH
export ORACLE_SID=XE

# Conectar e criar o objeto DPUMP_DIR
sqlplus system/SUA_SENHA@localhost:1521/XEPDB1
```
No SQL*Plus:
```sql
CREATE OR REPLACE DIRECTORY DPUMP_DIR AS '/opt/oracle/oradata/dump';
EXIT;
```
Executar o `impdp`:
```bash
impdp system/SUA_SENHA@localhost:1521/XEPDB1 full=y \
  directory=DPUMP_DIR \
  dumpfile=full_export.dmp \
  logfile=full_import.log
```

---

## 5. Troubleshooting e Erros Comuns de Conectividade

| Erro / Sintoma | Causa Raiz | Solução Prática |
|---|---|---|
| `ORA-12154: TNS:could not resolve the connect identifier` | Nome TNS não mapeado no `tnsnames.ora`. | Utilizar string de conexão completa com host, porta e Service Name: `sqlplus system/senha@localhost:1521/XEPDB1`. |
| `ORA-39087: directory name DPUMP_DIR is invalid` | Diretório criado no CDB raiz enquanto o export/import é executado no PDB. | Conectar explicitamente no PDB (`XEPDB1`) antes de emitir o comando `CREATE DIRECTORY`. |
| `ORA-12541: TNS:no listener` | Porta 1521 bloqueada pelo `firewalld` ou Listener inativo. | Executar `firewall-cmd --permanent --add-port=1521/tcp && firewall-cmd --reload` e validar com `lsnrctl status`. |
| `bash: sqlplus: command not found` | Variáveis `ORACLE_HOME` e `PATH` não definidas na sessão do usuário. | Executar `export ORACLE_HOME=/opt/oracle/product/21c/dbhomeXE` e incluir `$ORACLE_HOME/bin` no `$PATH`. |
| Interface sem IP após reboot | Interface de rede Linux configurada com autoconexão desativada. | Executar `nmcli connection modify enp0s3 connection.autoconnect yes`. |
