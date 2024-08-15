```
utilisateur_connecte = True
compte_principal = True

def crediter(montant, compte):
   # Code pour créditer le montant au compte
   print(f"Crédit de {montant} XAF au compte {compte}")

def demander_credit(montant):
   if utilisateur_connecte:
      if compte_principal:
         crediter(montant, compte_principal)
         print("Crédit effectué avec succès")
      else:
         print("Erreur : veuillez vous connecter à votre compte principal")
   else:
      print("Erreur : veuillez vous connecter à votre compte")

demander_credit(15000)
```
