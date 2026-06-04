# Firestore İndeksleri ve Deploy Talimatları

Bu proje için Firestore composite index'lerini versiyon kontrolünde tutmak üzere `firestore.indexes.json` dosyası eklendi.

## CLI ile deploy (önerilen, tekrarlanabilir)

1. Firebase CLI yükleyin (eğer yoksa):

```bash
npm install -g firebase-tools
```

2. Firebase hesabınıza giriş yapın:

```bash
firebase login
```

3. Proje kimliğini seçin veya ekleyin:

```bash
firebase use --add
# veya
firebase use <project-id>
```

4. İndeksleri deploy edin:

```bash
firebase deploy --only firestore:indexes
```

Deploy tamamlandığında Firestore konsolu indekslerin oluşturulma durumunu gösterecektir. Index oluşturma birkaç dakika sürebilir.

## Konsoldan (hızlı)

Eğer hata mesajı size bir konsol URL'i veriyorsa, o URL'i açıp `Create index` butonuna basarak indeksi doğrudan oluşturabilirsiniz.

## Notlar

- `firestore.indexes.json` dosyası versiyon kontrolüne eklenmiştir; CI/CD boru hattınızda `firebase deploy --only firestore:indexes` komutunu kullanabilirsiniz.
- Bir indeks oluştuktan sonra ilgili sorgular genellikle daha hızlı ve hata vermeden çalışır.
